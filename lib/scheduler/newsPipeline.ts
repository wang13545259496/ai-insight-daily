import { prisma } from "@/lib/prisma";
import { fetchRSSNews } from "@/lib/rss";
import { generateSummary } from "@/lib/ai-summary";
import { buildEventClusters } from "@/lib/intelligence/eventCluster";
import { linkNewsEvents } from "@/lib/intelligence/linkNewsEvent";
import { refreshEventScores } from "@/lib/intelligence/refreshEvents";
import { getHotNews } from "@/lib/news/getHotNews";
import { getNewsTrend } from "@/lib/news/predictTrend";
import { saveDailyReport } from "@/lib/daily/saveDailyReport";

function normalizeTitle(title: string) {
  return String(title || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function qualityScore(
  title: string,
  content: string,
  sourceUrl: string
) {
  let score = 0;

  if (title.length >= 10) score += 30;
  if (content.length >= 80) score += 35;
  if (content.length >= 250) score += 15;
  if (sourceUrl) score += 20;

  return Math.min(100, score);
}

export async function runNewsPipeline() {
  const startedAt = Date.now();

  console.log("========== AI Insight Daily 自动情报流水线 ==========");

  const rssNews = await fetchRSSNews();

  let imported = 0;
  let duplicated = 0;

  for (const item of rssNews) {
    const title = String(item.title || "").trim();

    if (!title) continue;

    const normalizedTitle = normalizeTitle(title);

    const existing = await prisma.news.findFirst({
      where: {
        OR: [
          ...(item.sourceUrl
            ? [{ sourceUrl: item.sourceUrl }]
            : []),
          {
            title: {
              equals: title,
            },
          },
        ],
      },
    });

    if (existing) {
      duplicated++;

      const mergedSources = Array.from(
        new Set([
          existing.source,
          item.source,
        ])
      ).join("、");

      await prisma.news.update({
        where: {
          id: existing.id,
        },
        data: {
          sourceCount: Math.max(
            existing.sourceCount,
            mergedSources.split("、").length
          ),
          originalSourceCount: Math.max(
            existing.originalSourceCount,
            mergedSources.split("、").length
          ),
          mergedSources,
          sourceUrl:
            existing.sourceUrl ||
            item.sourceUrl ||
            undefined,
        },
      });

      continue;
    }

    const created = await prisma.news.create({
      data: {
        title,
        category: item.category || "AI资讯",
        background: "等待AI分析",
        summary:
          item.summary ||
          "等待AI分析生成新闻摘要。",
        content:
          item.content ||
          title,
        source: item.source,
        sourceUrl:
          item.sourceUrl || undefined,
        verified: false,
        dataStatus: "active",
        sourceCount: 1,
        originalSourceCount: 1,
        analysisStatus: "pending",
      },
    });

    imported++;

    console.log(
      `新增新闻 #${created.id}: ${created.title}`
    );
  }

  const pending = await prisma.news.findMany({
    where: {
      analysisStatus: "pending",
      dataStatus: "active",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
  });

  let analyzed = 0;
  let analysisFailed = 0;

  for (const item of pending) {
    try {
      const result = await generateSummary(
        item.title,
        item.content
      );

      await prisma.news.update({
        where: {
          id: item.id,
        },
        data: {
          background: result.background,
          summary: result.summary,
          content: result.content,
          insight: result.insight,
          impact: result.impact,
          businessOpportunity:
            result.businessOpportunity,
          investmentView:
            result.investmentView,
          aiScore: result.aiScore,
          analysisStatus: "completed",
        },
      });

      analyzed++;
    } catch (error) {
      analysisFailed++;

      console.error(
        `AI分析失败 #${item.id}:`,
        error
      );

      await prisma.news.update({
        where: {
          id: item.id,
        },
        data: {
          analysisStatus: "failed",
        },
      });
    }
  }

  const clustering = await buildEventClusters();
  const linking = await linkNewsEvents();
  const eventRefresh = await refreshEventScores();

  const hotNews = await getHotNews(10);
  const trends = await getNewsTrend();

  const report = await saveDailyReport();

  const duration = Date.now() - startedAt;

  console.log(
    `流水线完成，耗时 ${duration}ms`
  );

  return {
    success: true,
    duration,
    rss: {
      fetched: rssNews.length,
      imported,
      duplicated,
    },
    analysis: {
      pending: pending.length,
      analyzed,
      failed: analysisFailed,
    },
    events: {
      clustering,
      linking,
      refresh: eventRefresh,
    },
    hotNews: hotNews.length,
    trends: trends.length,
    reportId: report.id,
  };
}
