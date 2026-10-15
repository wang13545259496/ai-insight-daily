import { prisma } from "@/lib/prisma";
import {
  createTitleHash,
  mergeSourceLabel,
  normalizeTitle,
  splitSourceLabel,
} from "@/lib/news/dedup";
import { cleanContent, isBadContent } from "@/lib/news/contentCleaner";
import { checkContentQuality } from "@/lib/news/contentQualityScore";
import { classifyNewsType } from "@/lib/news/newsTypeClassifier";
import { extractArticleBody } from "@/lib/news/articleBody";

/**
 * 新闻入库的唯一入口。
 *
 * 为什么要有这个模块：此前项目里有 4 条并行入库路径
 * （lib/scheduler/newsPipeline、lib/news-import、app/api/news/import、
 * app/api/import-news），各自去重规则不同——有的只比标题精确值、
 * 有的连 duplicateHash 都不写。它们写同一张 News 表，导致同一篇文章
 * 重复入库、来源标注互相覆盖（实测 1078 条 82% 的多源标注是错的）。
 *
 * 同时，项目里已有一套成熟的清洗能力（contentCleaner /
 * contentQualityScore / newsTypeClassifier），但只挂在
 * lib/rss/storage/saveRSSNews.ts 上，而那条链路只被
 * `npm run rss:scheduler` 调用——不在任何 cron 里。
 * 也就是说日常跑的流水线从来不调清洗。本模块把这些能力接进主链路。
 *
 * 处理顺序（顺序很重要，踩过坑）：
 *   1. 正文补全   —— RSS 只给导语的中文源，按链接抓正文
 *   2. 污染检测   —— 用**原始**内容，此时特征尚未被清洗掉
 *   3. 内容清洗   —— 去 HTML / JS / JSON-LD / 注释
 *   4. 质量评分   —— 命中污染则标 repair 而非丢弃（治理规范要求）
 *   5. 类型判定   —— 区分新闻 / 产品页 / 公司页
 *   6. 去重入库   —— 哈希 → URL → 归一化标题
 */

/** 一条待入库的新闻（来自 RSS 或网页抓取） */
export interface IngestItem {
  title: string;
  sourceName: string;
  sourceUrl?: string;
  category?: string;
  content?: string;
  summary?: string;
  publishedAt?: Date;
}

/** 入库结果统计 */
export interface IngestResult {
  fetched: number;
  created: number;
  duplicated: number;
  merged: number;
  skipped: number;
  /** 正文过短被丢弃（含正文抓取失败） */
  emptyContent: number;
  /** 判定为产品页 / 公司页被丢弃 */
  notNews: number;
  /** 正文污染但按规范保留、标记为 repair */
  repaired: number;
  /** 正文经抓取补全的条数 */
  bodyFetched: number;
  errors: string[];
}

/** 标题过短视为无效（导航项、栏目名） */
const MIN_TITLE_LENGTH = 8;

/**
 * 正文最小长度。
 *
 * 实测各源正文长度差异极大：BAIR Blog 15743 字、arXiv 1600 字、
 * OpenAI 151 字，而量子位 RSS 只有 16 字、InfoQ 只有 7 字
 * （content 是「点击查看原文」链接占位符）。
 * 低于此长度只有标题可用，喂给下游 AI 分析只会产出空洞新闻。
 */
const MIN_CONTENT_LENGTH = 40;

/** 只保留近 30 天的内容 */
const RECENT_DAYS = 30;

/**
 * 需要抓取正文的源：RSS 只给导语，不含正文。
 *
 * 实测（2026-10，对比「库内 content」与「文章页实际正文」）：
 *
 *   MIT Technology Review  262-287 字 → 4422-29343 字（提升 15-112×）
 *   MIT News AI            165-203 字 → 8656-10728 字（提升 42-58×）
 *   量子位                  16 字     → 161-4903 字
 *   InfoQ 中文              7 字      → 347-5098 字
 *
 * 为什么必须补全：RSS 导语过短时，下游 AI 分析没有材料，
 * 只能产出「新闻标题为X，正文仅重复标题并注明来源」这类元描述式摘要
 * （实测占库内 12.1%）。补全正文后这类摘要自然消失。
 *
 * 未纳入的源（RSS 已给足正文，无需额外请求）：
 *   OpenAI 官方博客、arXiv、Simon Willison、OSChina、量子位以外的中文源等。
 *
 * 注意：Microsoft AI Blog 虽属导语型，但实测 RSS 与文章页均返回 403
 * （服务器拒绝），无法补全，已停用该源。
 */
const BODY_FETCH_SOURCES = new Set([
  "量子位",
  "InfoQ 中文",
  "MIT News AI",
  "MIT Technology Review",
]);

/** 抓取正文时的并发上限，避免对同一站点高频请求 */
const BODY_FETCH_CONCURRENCY = 3;

/** 单个正文请求超时（毫秒） */
const BODY_FETCH_TIMEOUT_MS = 15000;

/**
 * 按链接抓取正文。
 * 失败返回 null，由调用方回退使用 RSS 导语。
 */
async function fetchArticleBody(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BODY_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    return extractArticleBody(html, url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 受控并发地处理数组，保持结果顺序 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);

  if (items.length === 0) return results;

  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;

      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);

  return results;
}

/** 判断发布时间是否在有效期内 */
function isRecent(date: Date | undefined): boolean {
  if (!date) return true;

  const limit = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;

  return date.getTime() >= limit;
}

/**
 * 正文补全：对 RSS 只给导语的源，按链接抓取正文。
 *
 * 结果写回 item.content。抓取失败保持原样，后续会因正文过短被丢弃，
 * 不会入库空洞记录。
 */
async function enrichBodies(items: IngestItem[]): Promise<{
  items: IngestItem[];
  fetched: number;
  attempts: number;
}> {
  const targets = items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        BODY_FETCH_SOURCES.has(item.sourceName) &&
        Boolean(item.sourceUrl) &&
        String(item.content || item.summary || "").length < MIN_CONTENT_LENGTH,
    );

  if (targets.length === 0) {
    return { items, fetched: 0, attempts: 0 };
  }

  console.log(`[ingest] 需补全正文 ${targets.length} 条（源：${[...BODY_FETCH_SOURCES].join("、")}）`);

  const bodies = await mapWithConcurrency(targets, BODY_FETCH_CONCURRENCY, ({ item }) =>
    fetchArticleBody(String(item.sourceUrl)),
  );

  const updated = [...items];
  let fetched = 0;

  bodies.forEach((body, index) => {
    if (!body) return;

    const target = targets[index];

    updated[target.index] = { ...target.item, content: body };
    fetched++;
  });

  console.log(`[ingest] 正文补全成功 ${fetched}/${targets.length} 条`);

  return { items: updated, fetched, attempts: targets.length };
}

/**
 * 入库主流程。
 */
export async function ingestNewsItems(rawItems: IngestItem[]): Promise<IngestResult> {
  const result: IngestResult = {
    fetched: rawItems.length,
    created: 0,
    duplicated: 0,
    merged: 0,
    skipped: 0,
    emptyContent: 0,
    notNews: 0,
    repaired: 0,
    bodyFetched: 0,
    errors: [],
  };

  // ---------- 1. 正文补全 ----------
  const enriched = await enrichBodies(rawItems);

  result.bodyFetched = enriched.fetched;

  const items = enriched.items;

  // 来源名 → Source 记录，用于关联 sourceId
  const sourceRecords = await prisma.source.findMany({
    select: { id: true, name: true },
  });

  const sourceByName = new Map(sourceRecords.map((item) => [item.name, item]));

  for (const item of items) {
    const title = String(item.title || "").replace(/\s+/g, " ").trim();

    if (!title || title.length < MIN_TITLE_LENGTH) {
      result.skipped++;
      continue;
    }

    const sourceName = String(item.sourceName || "").trim();

    if (!sourceName) {
      result.skipped++;
      continue;
    }

    if (!isRecent(item.publishedAt)) {
      result.skipped++;
      continue;
    }

    const rawContent = String(item.content || "").trim();
    const rawSummary = String(item.summary || "").trim();

    // ---------- 2. 内容清洗 ----------
    // 先清洗再检测，且检测对象与入库对象必须是同一个（清洗后的正文）。
    //
    // 踩过的坑：最初用 item.content（RSS 原始导语）做 isBadContent 检测，
    // 而 RSS 导语是 HTML 片段，其中的 cdn / static/ / assets/ / header /
    // footer 等词极易命中「页面源码污染」规则，导致正文明明已成功补全
    // （1500-26000 字）却被整批判为污染。
    const cleanedContent = cleanContent(rawContent);
    const cleanedSummary = cleanContent(rawSummary || rawContent);

    if (Math.max(cleanedContent.length, cleanedSummary.length) < MIN_CONTENT_LENGTH) {
      result.emptyContent++;
      continue;
    }

    // ---------- 3. 污染检测 ----------
    // 检测清洗后的正文：导航页、产品页、JS 残留等特征在清洗后仍会保留于文本中，
    // 因此这一步依然有效；而它针对的是**真正要入库的那份内容**。
    if (isBadContent(cleanedContent)) {
      result.notNews++;
      continue;
    }

    // ---------- 4. 质量评分 ----------
    const quality = checkContentQuality(cleanedContent);

    // ---------- 5. 类型判定 ----------
    const typeResult = classifyNewsType(title, cleanedContent);

    if (typeResult.type !== "news" && typeResult.score >= 50) {
      // 明确是产品页 / 公司页，不入库
      result.notNews++;
      continue;
    }

    const isRepair = quality.level === "polluted";
    const dataStatus = isRepair ? "repair" : "active";
    const cleanReason = isRepair ? `正文污染:${quality.reasons.join(",")}` : null;

    if (isRepair) result.repaired++;

    const hash = createTitleHash(title);
    const normalized = normalizeTitle(title);
    const sourceRecord = sourceByName.get(sourceName);

    try {
      // ---------- 6. 去重：哈希 → URL → 归一化标题 ----------
      let existing = await prisma.news.findUnique({
        where: { duplicateHash: hash },
        select: { id: true, source: true, title: true, sourceCount: true },
      });

      if (!existing && item.sourceUrl) {
        existing = await prisma.news.findFirst({
          where: { sourceUrl: item.sourceUrl },
          select: { id: true, source: true, title: true, sourceCount: true },
        });
      }

      if (!existing && normalized) {
        const candidates = await prisma.news.findMany({
          where: { title: { startsWith: title.slice(0, Math.min(12, title.length)) } },
          select: { id: true, source: true, title: true, sourceCount: true },
          take: 20,
        });

        existing = candidates.find((row) => normalizeTitle(row.title) === normalized) || null;
      }

      if (existing) {
        const already = splitSourceLabel(existing.source);

        if (already.includes(sourceName)) {
          result.duplicated++;
          continue;
        }

        // 不同来源指向同一篇文章 → 正确的多源合并
        const merged = mergeSourceLabel(existing.source, sourceName);
        const newCount = splitSourceLabel(merged).length;

        await prisma.news.update({
          where: { id: existing.id },
          data: {
            mergedSources: merged,
            sourceCount: newCount,
            originalSourceCount: Math.max(existing.sourceCount, newCount),
            duplicateHash: hash,
          },
        });

        result.merged++;
        continue;
      }

      await prisma.news.create({
        data: {
          title,
          category: item.category || "AI资讯",
          background: "等待AI分析",
          summary: cleanedSummary || cleanedContent.slice(0, 180),
          content: cleanedContent,
          source: sourceName,
          sourceUrl: item.sourceUrl || undefined,
          publishedAt: item.publishedAt,
          verified: false,
          dataStatus,
          cleanReason,
          sourceCount: 1,
          originalSourceCount: 1,
          analysisStatus: "pending",
          duplicateHash: hash,
          sourceId: sourceRecord?.id,
        },
        select: { id: true },
      });

      result.created++;
    } catch (error) {
      const message = String(error);

      if (message.includes("Unique constraint") || message.includes("P2002")) {
        result.duplicated++;
        continue;
      }

      result.errors.push(`${title.slice(0, 40)}: ${message.split("\n")[0]}`);
    }
  }

  console.log(
    `[ingest] 抓取 ${result.fetched}｜正文补全 ${result.bodyFetched}｜新增 ${result.created}｜` +
      `重复 ${result.duplicated}｜合并 ${result.merged}｜非新闻 ${result.notNews}｜` +
      `标修复 ${result.repaired}｜空内容 ${result.emptyContent}｜跳过 ${result.skipped}｜` +
      `错误 ${result.errors.length}`,
  );

  return result;
}
