import { extractArticleBody } from "@/lib/news/articleBody";
import type { IngestItem } from "@/lib/news/ingest";

/**
 * Sitemap 源采集。
 *
 * 为什么需要这条路径：一批高价值源（DeepSeek、字节 Seed、通义 Qwen 等）
 * 没有 RSS，只提供 sitemap.xml。此前它们被标记为 type='web'，
 * 由 fetchWebSource 抓「首页」，产出的是站点标题级内容
 * （实测产物如「千帆大模型平台-企业级一站式大模型开发及应用开发平台」），
 * 属于典型脏数据。
 *
 * sitemap 比爬列表页可靠：它是官方声明的内容清单，含 URL 与修改时间，
 * 不受页面改版影响。实测这四个源的文章页正文均可抽取（1328-9961 字）。
 *
 * 流程：
 *   sitemap.xml → 过滤出文章 URL → 逐篇抽取正文 → 交给统一入库
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 单次采集每站最多取几篇文章 */
const MAX_ARTICLES_PER_SOURCE = 15;

/** 抓取正文的并发上限 */
const CONCURRENCY = 3;

/** 单个请求超时 */
const TIMEOUT_MS = 15000;

/** 正文过短视为抽取失败 */
const MIN_BODY_LENGTH = 200;

/**
 * 判断 sitemap 中的 URL 是否为文章页。
 *
 * 排除规则很关键：产品页、文档页、定价页会大量混入，
 * 实测华为云 sitemap 有 1518 条但绝大多数是产品文档，
 * 若不排除会把整个站点的页面都当成新闻。
 */
export function isArticleUrl(url: string, include?: RegExp): boolean {
  const u = url.toLowerCase();

  // 先看是否命中站点自定义规则
  if (include) {
    return include.test(u);
  }

  // 排除明确不是文章的类型
  if (
    /\/(product|pricing|docs?|api|console|login|signup|about|contact|terms|privacy|careers|brand|m-plan|research)\b/.test(
      u,
    )
  ) {
    return false;
  }

  // 仅保留文章特征
  return (
    /\/(news|blog|updates?|release|announce|changelog|posts?)\//.test(u) ||
    /\/\d{4}\/\d{2}\//.test(u) ||
    /news\d{4,}|v\d+[-.]\d+/.test(u)
  );
}

/** 带超时的文本抓取 */
async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" },
    });

    if (!response.ok) return null;

    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 从 sitemap XML 提取 <loc> 与 <lastmod> */
function parseSitemapEntries(xml: string): Array<{ url: string; lastmod?: Date }> {
  const entries: Array<{ url: string; lastmod?: Date }> = [];

  const blocks = xml.match(/<(?:url|sitemap)>[\s\S]*?<\/(?:url|sitemap)>/gi) || [];

  for (const block of blocks) {
    const loc = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i)?.[1];

    if (!loc) continue;

    const lastmodRaw = block.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i)?.[1];
    const lastmod = lastmodRaw ? new Date(lastmodRaw) : undefined;

    entries.push({
      url: loc.trim(),
      lastmod: lastmod && !Number.isNaN(lastmod.getTime()) ? lastmod : undefined,
    });
  }

  return entries;
}

/**
 * 收集 sitemap 中的全部 URL。
 * 支持 sitemap 索引（子 sitemap 递归一层）。
 */
export async function collectSitemapUrls(
  sitemapUrl: string,
): Promise<{ urls: Array<{ url: string; lastmod?: Date }>; errors: string[] }> {
  const errors: string[] = [];

  const xml = await fetchText(sitemapUrl);

  if (!xml) {
    return { urls: [], errors: [`无法获取 sitemap：${sitemapUrl}`] };
  }

  const isIndex = /<sitemapindex/i.test(xml);

  if (!isIndex) {
    return { urls: parseSitemapEntries(xml), errors };
  }

  // sitemap 索引：递归获取子 sitemap（只下一层）
  const children = parseSitemapEntries(xml).map((item) => item.url);

  const urls: Array<{ url: string; lastmod?: Date }> = [];

  for (const child of children.slice(0, 10)) {
    const childXml = await fetchText(child);

    if (!childXml) {
      errors.push(`子 sitemap 获取失败：${child}`);
      continue;
    }

    urls.push(...parseSitemapEntries(childXml));
  }

  return { urls, errors };
}

/** 受控并发 */
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

/**
 * 从 HTML 里取文章标题。
 *
 * 优先级（实测踩过坑）：
 *   1. og:title      —— 最可靠，通常是真标题
 *   2. 正文首行      —— 实测很多博客页正文首行就是标题
 *   3. <title> 清理后 —— 最后手段，它常带站点后缀或是栏目名
 *
 * 为什么不能直接用 <title>：实测字节 Seed 的页面标题是
 * 「团队动态 - 字节跳动Seed」（栏目名），DeepSeek 文档是
 * 「DeepSeek API Upgrade | DeepSeek API Docs」（带站点后缀），
 * 用作新闻标题会严重误导。
 */
function extractTitle(html: string, body: string | null, sourceUrl: string): string {
  const clean = (value: string): string =>
    String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;|&lsquo;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  /**
   * 去掉站点后缀。
   *
   * 判据必须严格——踩过三次坑：
   *   1. 只在 <title> 回退分支清理 → 漏掉 og:title 自带后缀的情况
   *      （DeepSeek 文档页 og:title 就是「DeepSeek API Upgrade | DeepSeek API Docs」）
   *   2. 无条件剥离管道符右侧 → 误伤真标题
   *      （「不止"生成"，更懂"设计"｜Seedream 5.0 Pro 发布」右侧是型号名）
   *   3. 用域名子串匹配 → 「Seedream」含「seed」、「Seedance」含「seed」，
   *      与 bytedance 域名片段撞车，把型号名当站点名剥离
   *
   * 因此只用**站点类关键词**判断，且要求它是独立词而非长词的一部分。
   */
  const stripSiteSuffix = (value: string): string => {
    let result = value.trim();

    /**
     * 判断一段文字是否"像站点名"。
     *
     * 用词边界而非子串包含：Seedream / Seedance 里的 "seed" 不算站点名，
     * 但独立的 "docs" / "blog" / "API Docs" 算。
     */
    const looksLikeSiteName = (text: string): boolean => {
      const t = text.trim();

      // 过长的右侧更可能是内容而非站点名
      if (t.length > 32) return false;

      // 站点类关键词，要求作为独立词出现（前后是边界或空格）
      const siteWord =
        /(?:^|[\s\-_/])(docs?|blog|news|home|official|website|portal|api)(?:$|[\s\-_/])/i.test(
          t,
        );

      // 中文站点名
      const zhSite = /官网|文档|首页|新闻|博客|团队动态|开发者|平台介绍/i.test(t);

      return siteWord || zhSite;
    };

    for (let i = 0; i < 3; i++) {
      const match = result.match(/^(.*?)\s*[|｜]\s*([^|｜]{2,40})$/u);

      if (!match) break;

      const head = match[1].trim();
      const tail = match[2].trim();

      if (!looksLikeSiteName(tail) || head.length < 8) break;

      result = head;
    }

    // 连字符形态：仅当右侧明显是站点名时剥离
    const dash = result.match(/^(.*?)\s+[-–—]\s+([^-–—]{2,25})$/u);

    if (dash && dash[1].trim().length >= 10 && looksLikeSiteName(dash[2])) {
      result = dash[1].trim();
    }

    return result;
  };

  // 1. og:title
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];

  if (og) {
    const candidate = stripSiteSuffix(clean(og));

    if (candidate.length >= 8) return candidate;
  }

  // 2. 正文首行（需与后续内容区分开，避免把整段当标题）
  if (body) {
    const firstLine = body
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);

    if (firstLine && firstLine.length >= 8 && firstLine.length <= 120) {
      return stripSiteSuffix(firstLine);
    }
  }

  // 3. <title> 回退
  const raw = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  if (!raw) return "";

  return stripSiteSuffix(clean(raw));
}

export interface SitemapSourceResult {
  items: IngestItem[];
  /** sitemap 中的总 URL 数 */
  total: number;
  /** 过滤后认为是文章的数量 */
  articles: number;
  /** 成功抽取正文的数量 */
  fetched: number;
  errors: string[];
}

/**
 * 采集一个 sitemap 源。
 *
 * @param include 站点自定义的文章 URL 正则；不传则用通用规则
 */
export async function fetchSitemapSource(options: {
  sourceName: string;
  sitemapUrl: string;
  include?: RegExp;
}): Promise<SitemapSourceResult> {
  const { sourceName, sitemapUrl, include } = options;

  const errors: string[] = [];

  const { urls, errors: sitemapErrors } = await collectSitemapUrls(sitemapUrl);

  errors.push(...sitemapErrors);

  if (urls.length === 0) {
    return { items: [], total: 0, articles: 0, fetched: 0, errors };
  }

  const articles = urls.filter((entry) => isArticleUrl(entry.url, include));

  if (articles.length === 0) {
    return { items: [], total: urls.length, articles: 0, fetched: 0, errors };
  }

  // 优先取最新的（有 lastmod 时按时间倒序）
  const sorted = [...articles].sort((a, b) => {
    const ta = a.lastmod?.getTime() ?? 0;
    const tb = b.lastmod?.getTime() ?? 0;

    return tb - ta;
  });

  const targets = sorted.slice(0, MAX_ARTICLES_PER_SOURCE);

  const results = await mapWithConcurrency(targets, CONCURRENCY, async (entry) => {
    const html = await fetchText(entry.url);

    if (!html) return null;

    const body = extractArticleBody(html, entry.url);

    if (!body || body.length < MIN_BODY_LENGTH) return null;

    const title = extractTitle(html, body, entry.url);

    if (!title || title.length < 8) return null;

    // 去掉正文首行里重复的标题（很多博客页正文首行就是标题本身）
    const cleanedBody =
      body.split("\n")[0]?.trim() === title
        ? body.split("\n").slice(1).join("\n").trim()
        : body;

    return {
      title,
      sourceName,
      sourceUrl: entry.url,
      category: "AI资讯",
      content: cleanedBody.length >= MIN_BODY_LENGTH ? cleanedBody : body,
      summary: body.slice(0, 200),
      publishedAt: entry.lastmod,
    } as IngestItem;
  });

  const items = results.filter((item): item is IngestItem => item !== null);

  return {
    items,
    total: urls.length,
    articles: articles.length,
    fetched: items.length,
    errors,
  };
}
