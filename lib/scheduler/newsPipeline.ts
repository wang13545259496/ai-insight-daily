import { prisma } from "@/lib/prisma";
import { fetchRSSNewsDetailed } from "@/lib/rss";
import { ingestNewsItems } from "@/lib/news/ingest";
import { generateSummary } from "@/lib/ai-summary";
import { mapWithConcurrency } from "@/lib/concurrency";
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
/**
 * 单轮最多分析多少条。
 *
 * 从 30 提高到 120 的原因：采集改为每天一次后，管线也一天只跑一轮。
 * 而实测日均入库 68 条，30 的上限会造成每天积压 38 条。
 * 之前每小时检查、一天最多 4 轮（容量 120），所以这个问题没暴露。
 *
 * 取 120 而非 70：手动触发时 RSS 一次能导入 93 条，偶尔更多。
 * 待分析数量不足时 take 只取到实际数量，不会空跑。
 */
const ANALYSIS_BATCH_LIMIT = 120;

/**
 * AI 分析的并发度。
 *
 * 实测（2026-10）：并发 12 时单条耗时（2.0 秒）与串行（1.7 秒）基本持平，
 * 未出现限流；DeepSeek 官方并发上限为 2500，余量极大。
 * 取 6 是保守选择——30 条分析从约 51 秒降至约 10 秒，
 * 同时避免与同日其它任务叠加时产生意外压力。
 *
 * 注意：并发度不是越高越好。大模型接口的吞吐受服务端调度影响，
 * 过高并发在服务降级时会放大失败（2026-10 故障期实测：
 * 请求挂起且无 HTTP 状态码，此时高并发会让整批一起卡住）。
 */
const ANALYSIS_CONCURRENCY = 6;

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

  const analysisStartedAt = Date.now();

  /*
   * 受控并发执行。
   *
   * 原实现逐条 await，30 条需 51 秒以上（单条超时 30 秒、重试 2 次时
   * 最坏 45 分钟）。改为并发后总耗时取决于最慢的一条，而非累加。
   *
   * mapWithConcurrency 保证：单条失败不中断整批（返回 null），
   * 结果顺序与输入一致。
   */
  await mapWithConcurrency(
    pending,
    ANALYSIS_CONCURRENCY,
    async (item) => {
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

        console.error(`AI分析失败 #${item.id}:`, String(error).split("\n")[0]);

        await prisma.news.update({
          where: { id: item.id },
          data: { analysisStatus: "failed" },
        });
      }

      return item.id;
    },
    (done, total) => {
      // 每 5 条报一次进度，便于在日志里观察并发效果
      if (done % 5 === 0 || done === total) {
        const elapsed = ((Date.now() - analysisStartedAt) / 1000).toFixed(1);

        console.log(`[pipeline] AI 分析进度 ${done}/${total}（${elapsed}s）`);
      }
    },
  );

  if (pending.length > 0) {
    const elapsed = ((Date.now() - analysisStartedAt) / 1000).toFixed(1);

    console.log(
      `[pipeline] AI 分析完成：${analyzed} 条成功、${analysisFailed} 条失败，` +
        `用时 ${elapsed}s（并发 ${ANALYSIS_CONCURRENCY}）`,
    );
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
