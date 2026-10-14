import { prisma } from "@/lib/prisma";
import { fetchRSSNewsDetailed } from "@/lib/rss";
import { ingestNewsItems } from "@/lib/news/ingest";
import { generateSummary } from "@/lib/ai-summary";
import { buildEventClusters } from "@/lib/intelligence/eventCluster";
import { linkNewsEvents } from "@/lib/intelligence/linkNewsEvent";
import { refreshEventScores } from "@/lib/intelligence/refreshEvents";
import { getHotNews } from "@/lib/news/getHotNews";
import { getNewsTrend } from "@/lib/news/predictTrend";
import { saveDailyReport } from "@/lib/daily/saveDailyReport";

/**
 * 每日情报流水线。
 *
 * 由 cron 每天调用一次（见 app/api/cron/daily/route.ts）。
 *
 * 抓取与入库已抽到独立模块：
 *   - lib/rss.ts          按数据库 Source 表抓取
 *   - lib/news/ingest.ts  统一去重与来源合并
 *
 * 这样做的原因：此前本文件内联了一套去重逻辑（只比标题精确值、
 * 命中后立即把两个来源名拼起来当「多来源」），而 lib/news-import.ts
 * 与另两个 API 路由各自又有一套，规则互不一致。
 * 它们写同一张表，导致重复入库与来源误标（实测 1078 条 82% 标注错误）。
 */

/** 每次流水线最多做多少条 AI 分析，控制耗时与调用成本 */
const ANALYSIS_BATCH_LIMIT = 30;

export async function runNewsPipeline() {
  const startedAt = Date.now();

  console.log("========== AI Insight Daily 自动情报流水线 ==========");

  // ---------- 1. 抓取 ----------
  const fetched = await fetchRSSNewsDetailed();

  const failedSources = fetched.sources.filter((item) => item.error);

  console.log(
    `[pipeline] 抓取完成：${fetched.sources.length} 个源、${fetched.items.length} 条` +
      (failedSources.length > 0
        ? `，其中 ${failedSources.length} 个源失败：${failedSources
            .map((item) => item.name)
            .join("、")}`
        : ""),
  );

  // ---------- 2. 入库（统一去重） ----------
  const ingest = await ingestNewsItems(fetched.items);

  // ---------- 3. AI 分析 ----------
  const pending = await prisma.news.findMany({
    where: {
      analysisStatus: "pending",
      dataStatus: "active",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: ANALYSIS_BATCH_LIMIT,
  });

  let analyzed = 0;
  let analysisFailed = 0;

  for (const item of pending) {
    try {
      const result = await generateSummary(item.title, item.content);

      await prisma.news.update({
        where: { id: item.id },
        data: {
          background: result.background,
          summary: result.summary,
          content: result.content,
          insight: result.insight,
          impact: result.impact,
          businessOpportunity: result.businessOpportunity,
          investmentView: result.investmentView,
          aiScore: result.aiScore,
          analysisStatus: "completed",
        },
      });

      analyzed++;
    } catch (error) {
      analysisFailed++;

      console.error(`AI分析失败 #${item.id}:`, error);

      await prisma.news.update({
        where: { id: item.id },
        data: { analysisStatus: "failed" },
      });
    }
  }

  // ---------- 4. 事件与报告 ----------
  const clustering = await buildEventClusters();
  const linking = await linkNewsEvents();
  const eventRefresh = await refreshEventScores();

  const hotNews = await getHotNews(10);
  const trends = await getNewsTrend();

  const report = await saveDailyReport();

  const duration = Date.now() - startedAt;

  console.log(
    `流水线完成：抓取 ${ingest.fetched}、新增 ${ingest.created}、重复 ${ingest.duplicated}、` +
      `合并 ${ingest.merged}、空内容丢弃 ${ingest.emptyContent}，耗时 ${duration}ms`,
  );

  return {
    success: true,
    duration,
    rss: {
      sources: fetched.sources.length,
      failedSources: failedSources.map((item) => ({
        name: item.name,
        error: item.error,
      })),
      fetched: ingest.fetched,
      imported: ingest.created,
      duplicated: ingest.duplicated,
      merged: ingest.merged,
      skipped: ingest.skipped,
      // 空内容条数单独暴露：RSS 只给标题的源会在这里体现出来
      emptyContent: ingest.emptyContent,
      errors: ingest.errors.slice(0, 10),
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
