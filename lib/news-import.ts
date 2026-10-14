import { fetchRSSNews } from "@/lib/rss";
import { ingestNewsItems, type IngestItem } from "@/lib/news/ingest";

/**
 * 新闻导入（保留给手动触发的接口使用）。
 *
 * 入库统一下沉到 lib/news/ingest.ts：那边做确定性去重
 * （duplicateHash / sourceUrl / 归一化标题）并写入哈希字段。
 *
 * 本文件此前是独立实现——只按标题精确值查重、不写 duplicateHash，
 * 于是经它入库的记录永远绕过唯一索引，成为重复数据的来源之一。
 * 现在只保留「分类」这一项本模块特有的能力。
 */

/** 按标题关键词判定所属板块 */
export function classifyNews(title: string): string {
  const text = String(title || "").toLowerCase();

  if (text.includes("agent") || text.includes("智能体") || text.includes("自动化")) {
    return "Agent";
  }

  if (text.includes("机器人") || text.includes("robot") || text.includes("robotics")) {
    return "机器人";
  }

  if (
    text.includes("gpt") ||
    text.includes("模型") ||
    text.includes("大模型") ||
    text.includes("llm") ||
    text.includes("claude") ||
    text.includes("gemini")
  ) {
    return "AI模型";
  }

  if (
    text.includes("创业") ||
    text.includes("融资") ||
    text.includes("startup") ||
    text.includes("投资")
  ) {
    return "AI创业";
  }

  return "行业动态";
}

export async function importNews() {
  const rssNews = await fetchRSSNews();

  const items: IngestItem[] = rssNews.map((item) => ({
    ...item,
    // 本入口的定位是「按板块归类」，因此覆盖为分类结果
    category: classifyNews(item.title),
  }));

  const result = await ingestNewsItems(items);

  return {
    success: true,
    created: result.created,
    duplicated: result.duplicated,
    merged: result.merged,
    emptyContent: result.emptyContent,
    total: result.fetched,
    errors: result.errors,
  };
}
