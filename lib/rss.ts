import Parser from "rss-parser";

import { prisma } from "@/lib/prisma";
import { fetchSitemapSource } from "@/lib/news/sitemapSource";

import type { IngestItem } from "@/lib/news/ingest";

/**
 * 新闻采集：按 Source 表的 type 分派到对应采集器。
 *
 * 重要变更（2026-10）：源清单从 config/sources.ts 改为读取数据库
 * Source 表。原因是两处清单长期不一致——config/sources.ts 里
 * 6 个源只有 OpenAI 标注为 rss，其余被 `if (source.type !== "rss") continue`
 * 静默跳过，导致生产链路实际只采集 1 个源，库中 96% 的新闻
 * 来自 OpenAI，而 Source 表里明明已有配好可用 RSS 的 Google、
 * Microsoft 等源却从未被采集。
 *
 * 现在以数据库为准，并按 type 分派：
 *   rss      —— 标准 RSS/Atom，见下方
 *   sitemap  —— 无 RSS 但有 sitemap 的源（DeepSeek / 字节 Seed / 通义 Qwen）
 *   watch    —— 重点监控源，仅保留记录，不自动采集（等网页抓取能力）
 *
 * 采集健康度直接回写 Source 表，避免两套状态互相矛盾。
 */

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; AI-Insight-Daily/1.0; +https://aibiliai.com)",
  },
});

/** 单个源单次最多取多少条，避免首次接入时一次性灌入上千条 */
const MAX_ITEMS_PER_SOURCE = 30;

/**
 * sitemap 源的站点专用过滤规则。
 *
 * 通用规则已排除产品页/文档页，但个别站点仍需更精确的路径限定，
 * 否则会把无关页面当文章抓进来。
 */
const SITEMAP_RULES: Record<string, RegExp> = {
  "DeepSeek 官方博客": /\/news\/[a-z0-9-]+\/?$/i,
  "DeepSeek 文档动态": /\/news\/news\d+/i,
  "字节 Seed 博客": /\/blog\/[a-z0-9-]+/i,
  "通义 Qwen 博客": /\/blog\/[a-z0-9-]+\/?$/i,
};

/** 去 HTML 标签与常见实体，压缩空白 */
function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** 解析发布时间，失败返回 undefined */
function parseDate(item: Record<string, unknown>): Date | undefined {
  const raw = item.isoDate || item.pubDate;

  if (!raw) return undefined;

  const date = new Date(String(raw));

  return Number.isNaN(date.getTime()) ? undefined : date;
}

export interface FetchRSSResult {
  items: IngestItem[];
  /** 每个源的采集情况，便于排查「配了却没数据」的源 */
  sources: Array<{ name: string; count: number; kind: string; error?: string }>;
}

/**
 * 抓取所有启用的源。
 *
 * 返回结构从 RSSNews[] 改为 { items, sources }：调用方需要知道
 * 「哪个源失败了」，否则配错地址的源会静默无产出。
 */
export async function fetchRSSNewsDetailed(): Promise<FetchRSSResult> {
  const sourceRecords = await prisma.source.findMany({
    where: {
      enabled: true,
      // rss 与 sitemap 都是自动化源；watch 类型不参与采集
      type: { in: ["rss", "sitemap"] },
      NOT: { rssUrl: null },
    },
    select: { id: true, name: true, rssUrl: true, type: true, rssScore: true },
    orderBy: { rssScore: "desc" },
  });

  const items: IngestItem[] = [];
  const sources: FetchRSSResult["sources"] = [];

  for (const source of sourceRecords) {
    const url = String(source.rssUrl || "").trim();

    if (!url) continue;

    // ---------- sitemap 源 ----------
    if (source.type === "sitemap") {
      try {
        const result = await fetchSitemapSource({
          sourceName: source.name,
          sitemapUrl: url,
          include: SITEMAP_RULES[source.name],
        });

        items.push(...result.items);

        sources.push({ name: source.name, count: result.items.length, kind: "sitemap" });

        await prisma.source.update({
          where: { id: source.id },
          data: {
            lastFetch: new Date(),
            lastCollectTime: new Date(),
            status: "active",
            rssStatus: result.items.length > 0 ? "healthy" : "empty",
            collectCount: { increment: 1 },
            rssSuccessCount: { increment: 1 },
            rssTotalCount: { increment: result.items.length },
            lastError: result.errors.length > 0 ? result.errors[0] : null,
          },
        });

        console.log(
          `[sitemap] ${source.name}: sitemap ${result.total} 条 URL → ` +
            `文章 ${result.articles} 篇 → 正文成功 ${result.fetched} 篇`,
        );
      } catch (error) {
        const message = String(error).split("\n")[0];

        sources.push({ name: source.name, count: 0, kind: "sitemap", error: message });

        console.error(`[sitemap] ${source.name} 采集失败: ${message}`);

        await prisma.source.update({
          where: { id: source.id },
          data: {
            lastFetch: new Date(),
            status: "error",
            rssStatus: "error",
            errorCount: { increment: 1 },
            collectErrorCount: { increment: 1 },
            rssFailCount: { increment: 1 },
            lastError: message,
            lastCollectError: message,
          },
        });
      }

      continue;
    }

    // ---------- RSS 源 ----------
    try {
      const feed = await parser.parseURL(url);
      const list = (feed.items || []).slice(0, MAX_ITEMS_PER_SOURCE);
      let count = 0;

      for (const raw of list) {
        const item = raw as unknown as Record<string, unknown>;

        const title = cleanText(item.title);

        if (!title) continue;

        const content = cleanText(
          item.content || item["content:encoded"] || item.contentSnippet || item.summary,
        );

        const summary = cleanText(item.contentSnippet || item.summary);

        items.push({
          title,
          sourceName: source.name,
          sourceUrl: String(item.link || item.guid || "").trim() || undefined,
          category: "AI资讯",
          content,
          summary,
          publishedAt: parseDate(item),
        });

        count++;
      }

      sources.push({ name: source.name, count, kind: "rss" });

      await prisma.source.update({
        where: { id: source.id },
        data: {
          lastFetch: new Date(),
          lastCollectTime: new Date(),
          status: "active",
          rssStatus: "healthy",
          collectCount: { increment: 1 },
          rssSuccessCount: { increment: 1 },
          rssTotalCount: { increment: count },
        },
      });

      console.log(`[rss] ${source.name}: ${count} 条`);
    } catch (error) {
      const message = String(error).split("\n")[0];

      sources.push({ name: source.name, count: 0, kind: "rss", error: message });

      console.error(`[rss] ${source.name} 采集失败: ${message}`);

      await prisma.source.update({
        where: { id: source.id },
        data: {
          lastFetch: new Date(),
          status: "error",
          rssStatus: "error",
          errorCount: { increment: 1 },
          collectErrorCount: { increment: 1 },
          rssFailCount: { increment: 1 },
          lastError: message,
          lastCollectError: message,
        },
      });
    }
  }

  return { items, sources };
}

/**
 * 兼容旧调用方的简版接口。
 *
 * 仍返回扁平数组，供只做「预览」的接口（如 /api/rss-test）使用。
 * 入库请改用 fetchRSSNewsDetailed + ingestNewsItems。
 */
export async function fetchRSSNews(): Promise<IngestItem[]> {
  const { items } = await fetchRSSNewsDetailed();

  return items;
}
