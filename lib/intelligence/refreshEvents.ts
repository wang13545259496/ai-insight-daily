import { prisma } from "@/lib/prisma";

export async function refreshEventScores() {
  const events = await prisma.newsEvent.findMany({
    where: {
      status: "active",
    },
    include: {
      news: {
        select: {
          id: true,
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

  for (const event of events) {
    const activeNews = event.news.filter(
      (item) => item.dataStatus === "active"
    );

    if (!activeNews.length) continue;

    let heat = 0;
    let recent24h = 0;
    let recent72h = 0;

    for (const item of activeNews) {
      const ageHours = Math.max(
        0,
        (now - item.createdAt.getTime()) / 3600000
      );

      if (ageHours <= 24) recent24h++;
      if (ageHours <= 72) recent72h++;

      const recency = Math.exp(-ageHours / 30);

      heat +=
        recency *
        (
          8 +
          Number(item.aiScore || 0) * 0.3 +
          Math.min(15, Number(item.sourceCount || 1) * 2) +
          (item.verified ? 6 : 0)
        );
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
          0
        ) / activeNews.length
      ).toFixed(2)
    );

    /*
     * 今日重点的核心原则：
     *
     * 1. 最近24小时新增信息最重要
     * 2. 最近72小时持续活跃其次
     * 3. 内容质量再次
     * 4. 历史累计热度只作为基础参考
     *
     * 避免“老事件因为历史新闻很多而长期霸榜”。
     */

    const recent24Boost = Math.min(180, recent24h * 45);

    const recent72Only = Math.max(
      0,
      recent72h - recent24h
    );

    const recent72Boost = Math.min(
      90,
      recent72Only * 12
    );

    const qualityBoost = qualityScore * 0.65;

    const historicalHeat = Math.min(
      120,
      heat * 0.22
    );

    const heatScore = Number(
      Math.min(
        1000,
        recent24Boost +
          recent72Boost +
          qualityBoost +
          historicalHeat
      ).toFixed(2)
    );

    const peakScore = Math.max(
      Number(event.peakScore || 0),
      heatScore
    );

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
        : "近期新增信息有限，事件即时关注度有所下降。";

    await prisma.newsEvent.update({
      where: {
        id: event.id,
      },
      data: {
        heatScore,
        peakScore,
        trendStatus,
        qualityScore,
        trendSummary,
        updatedAt: new Date(),
      },
    });

    updated++;
  }

  return { updated };
}
