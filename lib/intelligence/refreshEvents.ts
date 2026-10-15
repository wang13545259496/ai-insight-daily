import { prisma } from "@/lib/prisma";
import { calcIndustryScore } from "@/lib/ranking/industryScore";

/**
 * 刷新事件分数。
 *
 * 产出两个排序依据：
 *   heatScore     —— 热度（新闻数量 × 新近度 × aiScore），衡量「有多热」
 *   industryScore —— 产业价值分，衡量「有多值得上首页」
 *
 * 为什么需要 industryScore：首页「今日重点」原先直接按 heatScore 排序，
 * 而 heatScore 只看数量与新旧。arXiv 每日稳定产出、开源项目频繁更新，
 * 数量一多热度自然上去，于是论文与技术随笔挤占了产业事件的焦点位。
 * 产业价值分引入企业关联度、产业动作信号，并对学术来源扣分。
 *
 * 时间维度（recency、24h/72h 计数）保持不变，仅新增产业分计算。
 */
export async function refreshEventScores() {
  const events = await prisma.newsEvent.findMany({
    where: {
      status: "active",
    },
    include: {
      news: {
        select: {
          id: true,
          title: true,
          source: true,
          createdAt: true,
          aiScore: true,
          verified: true,
          sourceCount: true,
          dataStatus: true,
        },
      },
    },
  });

  const now = Date.now();
  let updated = 0;
  let filtered = 0;
  let topIndustry = 0;
  let topTitle = "";

  for (const event of events) {
    const activeNews = event.news.filter((item) => item.dataStatus === "active");

    if (!activeNews.length) continue;

    let heat = 0;
    let recent24h = 0;
    let recent72h = 0;

    for (const item of activeNews) {
      const ageHours = Math.max(0, (now - item.createdAt.getTime()) / 3600000);

      if (ageHours <= 24) recent24h++;
      if (ageHours <= 72) recent72h++;

      const recency = Math.exp(-ageHours / 30);

      heat +=
        recency *
        (8 +
          Number(item.aiScore || 0) * 0.3 +
          Math.min(15, Number(item.sourceCount || 1) * 2) +
          (item.verified ? 6 : 0));
    }

    const qualityScore = Number(
      Math.min(
        100,
        activeNews.reduce(
          (sum, item) =>
            sum +
            Number(item.aiScore || 0) * 0.7 +
            (item.verified ? 15 : 0) +
            Math.min(10, Number(item.sourceCount || 1) * 2),
          0,
        ) / activeNews.length,
      ).toFixed(2),
    );

    const recent24Boost = Math.min(180, recent24h * 45);

    const recent72Only = Math.max(0, recent72h - recent24h);

    const recent72Boost = Math.min(90, recent72Only * 12);

    const qualityBoost = qualityScore * 0.65;

    const historicalHeat = Math.min(120, heat * 0.22);

    const heatScore = Number(
      Math.min(
        1000,
        recent24Boost + recent72Boost + qualityBoost + historicalHeat,
      ).toFixed(2),
    );

    // ---------- 产业价值分 ----------
    const industry = calcIndustryScore(
      event.title,
      activeNews.map((item) => ({ title: item.title, source: item.source })),
      heatScore,
    );

    if (industry.score > topIndustry) {
      topIndustry = industry.score;
      topTitle = event.title;
    }

    const peakScore = Math.max(Number(event.peakScore || 0), heatScore);

    const trendStatus =
      recent24h >= 5
        ? "爆发增长"
        : recent24h >= 3
          ? "快速上升"
          : recent24h >= 1
            ? "最新动态"
            : recent72h >= 2
              ? "持续关注"
              : "热度下降";

    const trendSummary =
      trendStatus === "爆发增长"
        ? "24小时内新增信息快速增加，事件正在形成明显的即时关注。"
        : trendStatus === "快速上升"
          ? "近期新增信息明显增加，事件关注度正在快速上升。"
          : trendStatus === "最新动态"
            ? "24小时内出现新的相关信息，属于当前值得关注的产业动态。"
            : trendStatus === "持续关注"
              ? "72小时内仍有持续信息进入，事件保持一定行业关注度。"
              : "近期新增信息趋于稳定，事件进入持续跟踪阶段。";

    await prisma.newsEvent.update({
      where: {
        id: event.id,
      },
      data: {
        heatScore,
        peakScore,
        trendStatus,
        qualityScore,
        industryScore: industry.score,
        // eventType 复用于标记「产业相关性」，供首页筛选。
        //
        // 为什么复用而不是新增字段：该字段此前由 eventCluster 硬编码为 "news"，
        // 全项目无任何生产代码读写它（仅几个一次性脚本引用，均不在调度中），
        // 属闲置字段。存「产业相关 / 已被过滤」比再加一列更省事。
        //
        // 过滤理由由 industryScore 模块判定，例如「单篇且无产业信号」
        // （技术随笔、品牌联名活动）、「学术来源占比过高」（arXiv 论文）。
        eventType: industry.eligible ? "industry" : "filtered",
        trendSummary,
        updatedAt: new Date(),
      },
    });

    if (!industry.eligible) {
      filtered++;
    }

    updated++;
  }

  if (topTitle) {
    console.log(
      `[events] 产业价值分最高：${topTitle}（${topIndustry.toFixed(1)} 分）｜` +
        `已刷新 ${updated} 个，其中 ${filtered} 个标记为不相关`,
    );
  }

  return { updated, filtered };
}
