import { sourceConfigs } from "./sourceConfig";

import { fetchRSS } from "./rss";

import { fetchWeb } from "./web";

import { fetchAPI } from "./api";

export interface UnifiedNews {
  title: string;

  content: string;

  source: string;

  url?: string;

  date: string;

  type: string;

  trust: number;
}

export async function fetchAllSources(): Promise<UnifiedNews[]> {
  const allNews: UnifiedNews[] = [];

  for (const source of sourceConfigs) {
    if (!source.enabled) {
      continue;
    }

    interface RawFeedItem {
      title: string;

      description?: string;

      content?: string;

      link?: string;

      url?: string;

      date?: string;
    }

    let data: RawFeedItem[] = [];

    switch (source.method) {
      case "rss":
        data = await fetchRSS(source.url);

        break;

      case "web":
        data = await fetchWeb(source.url);

        break;

      case "api":
        data = await fetchAPI(source.url);

        break;
    }

    const formatted: UnifiedNews[] = data.map((item) => ({
      title: item.title,

      content: item.description || item.content || "",

      source: source.name,

      url: item.link || item.url,

      date: item.date || new Date().toISOString(),

      type: source.type,

      trust: source.trust,
    }));

    allNews.push(...formatted);
  }

  return allNews;
}
