import { analyzeNews } from "./newsAnalyzer";

import { rankNews } from "@/lib/analysis/ranking";

import type { RankableNews } from "@/lib/analysis/ranking";

export function generateDailyReport(newsList: RankableNews[]) {
  const ranked = rankNews(newsList);

  const reports = ranked.map((news) => {
    const analysis = analyzeNews({
      title: news.title,

      description: news.content,

      source: news.source,

      date: new Date().toISOString(),
    });

    return {
      ...analysis,

      score: news.score,

      originalContent: news.content,
    };
  });

  return reports.slice(0, 8);
}
