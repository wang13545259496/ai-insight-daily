import Parser from "rss-parser";
import { sources } from "../config/sources";

const parser = new Parser();

export interface RSSNews {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category?: string;
  content?: string;
  summary?: string;
  sourceUrl?: string;
  createdAt?: Date;
}

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchRSSNews() {
  const results: RSSNews[] = [];

  for (const source of sources) {
    if (source.type !== "rss") continue;

    try {
      const started = Date.now();
      const feed = await parser.parseURL(source.url);

      for (const item of feed.items.slice(0, 20)) {
        const title = cleanText(item.title);

        if (!title) continue;

        const link =
          String(item.link || item.guid || "").trim();

        const content = cleanText(
          (item as any).content ||
          (item as any)["content:encoded"] ||
          (item as any).contentSnippet ||
          item.summary ||
          ""
        );

        results.push({
          title,
          link,
          source: source.name,
          category: source.category,
          pubDate: item.pubDate || item.isoDate || "",
          content,
          summary: cleanText(item.contentSnippet || item.summary || ""),
          sourceUrl: link,
          createdAt: item.isoDate
            ? new Date(item.isoDate)
            : new Date(),
        });

        void started;
      }
    } catch (error) {
      console.error(`RSS读取失败: ${source.name}`, error);
    }
  }

  return results;
}
