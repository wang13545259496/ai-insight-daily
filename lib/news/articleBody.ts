/**
 * 文章正文抽取。
 *
 * 为什么需要：部分源（尤其中文源）的 RSS 只给标题与一句话导语。
 * 实测量子位 content 只有 16 字、InfoQ 只有 7 字（内容是
 * 「点击查看原文」链接占位符），而下游 generateSummary 需要正文
 * 才能做产业分析。因此需要按文章链接抓取正文。
 *
 * 实测结论（2026-10）：量子位与 InfoQ 均无验证码、无登录墙、
 * 正文直接存在于 HTML（非 JS 渲染），因此用纯文本解析即可，
 * 无需引入 cheerio / jsdom 等依赖。
 *
 * 抽取策略（按优先级）：
 *   1. 站点专用规则（siteRules）——针对已实测清楚的站点
 *   2. 通用容器匹配——按常见正文 class 名匹配
 *   3. <article> 标签
 *   4. 失败返回 null，由调用方回退使用 RSS 提供的导语
 */

/** 站点专用抽取规则 */
interface SiteRule {
  /** 匹配文章链接的域名关键词 */
  host: string;
  /** 正文起始标记：从这里开始截取 */
  startMarker: RegExp;
  /** 需要从结果中剔除的片段 */
  removeBlocks?: RegExp[];
}

const SITE_RULES: SiteRule[] = [
  {
    // 量子位：正文在 <div class="article"> 内，
    // 但该 div 前面的 article_info（作者/日期/来源）与 zhaiyao（摘要）
    // 都属于页面装饰，不是正文，因此从 zhaiyao 之后开始截取。
    host: "qbitai.com",
    startMarker: /<div[^>]*class=["'][^"']*zhaiyao[^"']*["'][^>]*>[\s\S]*?<\/div>/i,
    removeBlocks: [
      /<div[^>]*class=["'][^"']*(?:article_info|wx_img|share|comment|related|footer|sidebar)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    ],
  },
  {
    // InfoQ：使用语义化 <article> 标签
    host: "infoq.cn",
    startMarker: /<article[^>]*>/i,
  },
];

/** 通用正文容器选择器（按可靠性排序） */
const GENERIC_CONTAINERS = [
  /<article[^>]*>([\s\S]*?)<\/article>/i,
  /<div[^>]+class=["'][^"']*(?:article-content|article_content|articleContent|post-content|entry-content|rich_media_content|article-body|markdown-body|detail-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  /<main[^>]*>([\s\S]*?)<\/main>/i,
];

/** 页面装饰文本：命中则说明抓到了导航/页脚而非正文 */
const NOISE_MARKERS = [
  "扫码关注",
  "点击查看原文",
  "版权所有",
  "京ICP备",
  "沪ICP备",
  "登录后查看",
  "关注我们",
  "上一篇",
  "下一篇",
  "相关推荐",
];

/** HTML 转纯文本 */
export function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ") // 去注释：实测量子位页面有被注释的导航文本
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n") // 块级元素保留换行
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** 找出站点专用规则 */
function findSiteRule(url: string): SiteRule | null {
  try {
    const host = new URL(url).hostname;

    return SITE_RULES.find((rule) => host.includes(rule.host)) ?? null;
  } catch {
    return null;
  }
}

/**
 * 从 HTML 中抽取正文纯文本。
 * 抽不到或结果过短时返回 null，由调用方回退。
 */
export function extractArticleBody(html: string, url: string): string | null {
  const source = String(html || "");

  if (source.length < 500) {
    return null;
  }

  const candidates: string[] = [];

  // ---------- 1. 站点专用规则 ----------
  const rule = findSiteRule(url);

  if (rule) {
    const marker = source.match(rule.startMarker);

    if (marker && marker.index !== undefined) {
      let slice = source.slice(marker.index + marker[0].length);

      // 只在正文范围内截断：遇到页脚/评论区的容器就停
      const stop = slice.search(
        /<div[^>]*class=["'][^"']*(?:footer|comment|related|recommend|share)[^"']*["']/i,
      );

      if (stop > 0) {
        slice = slice.slice(0, stop);
      }

      for (const remove of rule.removeBlocks ?? []) {
        slice = slice.replace(remove, " ");
      }

      candidates.push(htmlToText(slice));
    }
  }

  // ---------- 2. 通用容器 ----------
  for (const pattern of GENERIC_CONTAINERS) {
    const match = source.match(pattern);

    if (match?.[1]) {
      candidates.push(htmlToText(match[1]));
    }
  }

  // ---------- 3. 选最长的，并做噪声校验 ----------
  const usable = candidates
    .map((text) => text.trim())
    .filter((text) => text.length >= 200)
    .sort((a, b) => b.length - a.length);

  if (usable.length === 0) {
    return null;
  }

  const best = usable[0];

  // 噪声占比过高说明抓到了导航/页脚，宁可回退也不入库脏数据
  const noiseHits = NOISE_MARKERS.filter((marker) => best.includes(marker)).length;

  if (noiseHits >= 3) {
    return null;
  }

  return best;
}
