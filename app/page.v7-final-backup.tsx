import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "暂无时间";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "暂无时间";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function getTimeAgo(date: Date | string | null | undefined) {
  if (!date) return "";

  const time = new Date(date).getTime();

  if (Number.isNaN(time)) return "";

  const diff = Date.now() - time;

  if (diff < 60 * 60 * 1000) {
    return "刚刚更新";
  }

  if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  }

  return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;
}

function getTrendLabel(
  recent24h: number,
  recent72h: number,
  latestNewsTitle?: string | null
) {
  if (recent24h > 0) {
    return latestNewsTitle
      ? "过去24小时出现新动态，说明该事件仍在持续发展。"
      : "过去24小时出现新动态，值得持续跟踪。";
  }

  if (recent72h >= 2) {
    return "近72小时持续出现相关信息，热度仍在延续。";
  }

  if (recent72h === 1) {
    return "近72小时出现新的相关信息，建议继续观察后续变化。";
  }

  return "目前缺少近期新增信息，暂作为背景事件观察。";
}

function getScoreLabel(score: number) {
  if (score >= 220) return "高关注";
  if (score >= 160) return "重点";
  if (score >= 100) return "关注";
  return "观察";
}

function safeText(value: string | null | undefined, fallback: string) {
  const text = value?.trim();

  return text ? text : fallback;
}

export default async function HomePage() {
  const now = new Date();

  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  const [
    allEvents,
    latestNews,
    opportunities,
    investments,
    newsCount,
    eventCount,
  ] = await Promise.all([
    prisma.newsEvent.findMany({
      where: {
        status: "active",
      },
      include: {
        news: {
          where: {
            dataStatus: "active",
            publishedAt: {
              gte: last72h,
            },
          },
          orderBy: {
            publishedAt: "desc",
          },
          take: 8,
          select: {
            id: true,
            title: true,
            summary: true,
            source: true,
            sourceUrl: true,
            publishedAt: true,
            createdAt: true,
            aiScore: true,
            category: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),

    prisma.news.findMany({
      where: {
        dataStatus: "active",
      },
      orderBy: {
        publishedAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        title: true,
        summary: true,
        source: true,
        category: true,
        publishedAt: true,
        createdAt: true,
        aiScore: true,
        eventId: true,
      },
    }),

    prisma.businessOpportunity.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
    }),

    prisma.investment.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
    }),

    prisma.news.count({
      where: {
        dataStatus: "active",
      },
    }),

    prisma.newsEvent.count({
      where: {
        status: "active",
      },
    }),
  ]);

  /*
   * ============================================================
   * 今日重点最终排序
   *
   * 第一优先级：
   *   24小时内是否出现新动态
   *
   * 第二优先级：
   *   最近动态时间
   *
   * 第三优先级：
   *   最新新闻 AI 质量
   *
   * 第四优先级：
   *   72小时持续性
   *
   * 第五优先级：
   *   历史事件热度
   *
   * 重要：
   * 历史事件如果今天出现了新的新闻，也必须能够进入今日重点。
   * ============================================================
   */

  const focusEvents = allEvents
    .map((event) => {
      const recentNews = event.news.filter(
        (item) => new Date(item.publishedAt ?? item.createdAt).getTime() >= last72h.getTime()
      );

      const recent24News = recentNews.filter(
        (item) => new Date(item.publishedAt ?? item.createdAt).getTime() >= last24h.getTime()
      );

      const latestNews = recentNews[0] ?? null;

      const latestTime = latestNews
        ? new Date(latestNews.publishedAt ?? latestNews.createdAt).getTime()
        : 0;

      const recentAiScore = latestNews?.aiScore ?? 0;

      const recent24h = recent24News.length;
      const recent72h = recentNews.length;

      const focusScore =
        recent24h * 100 +
        recent72h * 18 +
        recentAiScore * 0.8 +
        event.qualityScore * 0.65 +
        Math.min(120, event.heatScore * 0.22);

      return {
        ...event,
        recentNews,
        recent24h,
        recent72h,
        latestNews,
        latestTime,
        recentAiScore,
        focusScore,
      };
    })
    .filter((event) => event.recent72h > 0)
    .sort((a, b) => {
      if (b.focusScore !== a.focusScore) {
        return b.focusScore - a.focusScore;
      }

      if (b.recent24h !== a.recent24h) {
        return b.recent24h - a.recent24h;
      }

      if (b.latestTime !== a.latestTime) {
        return b.latestTime - a.latestTime;
      }

      if (b.recentAiScore !== a.recentAiScore) {
        return b.recentAiScore - a.recentAiScore;
      }

      if (b.heatScore !== a.heatScore) {
        return b.heatScore - a.heatScore;
      }

      return b.qualityScore - a.qualityScore;
    })
    .slice(0, 6);

  const focusIds = new Set(focusEvents.map((item) => item.id));

  const displayLatestNews = latestNews
    .filter((item) => !item.eventId || !focusIds.has(item.eventId))
    .slice(0, 6);

  const averageScore =
    focusEvents.length > 0
      ? Math.round(
          focusEvents.reduce(
            (sum, item) => sum + Math.max(0, item.focusScore),
            0
          ) / focusEvents.length
        )
      : 0;

  return (
    <main className="min-h-screen bg-white text-black">
      {/* ============================================================
          HEADER
      ============================================================ */}
      <header className="border-b border-black bg-white">
        <div className="mx-auto max-w-7xl px-6 py-7 lg:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-black" />
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-gray-500">
                  AI Intelligence Platform
                </span>
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                AI Insight Daily
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                AI产业情报、事件监测、商业机会与投资观察的一体化信息驾驶舱。
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <Link
                href="/news"
                className="border border-black px-4 py-2 transition hover:bg-black hover:text-white"
              >
                AI资讯
              </Link>

              <Link
                href="/events"
                className="border border-black px-4 py-2 transition hover:bg-black hover:text-white"
              >
                事件中心
              </Link>

              <Link
                href="/industry"
                className="border border-black px-4 py-2 transition hover:bg-black hover:text-white"
              >
                产业趋势
              </Link>

              <Link
                href="/opportunity-map"
                className="border border-black px-4 py-2 transition hover:bg-black hover:text-white"
              >
                机会地图
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================
          今日重点
      ============================================================ */}
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="mb-8 flex flex-col gap-4 border-b border-gray-700 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                TODAY / FOCUS
              </div>

              <h2 className="text-3xl font-black tracking-tight">
                今日重点
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                优先展示最近24小时出现新动态、且仍在持续发展的AI产业事件。
              </p>
            </div>

            <Link
              href="/events"
              className="text-sm font-bold text-white underline decoration-gray-600 underline-offset-4 hover:decoration-white"
            >
              查看全部事件 →
            </Link>
          </div>

          {focusEvents.length === 0 ? (
            <div className="border border-gray-700 p-8 text-center text-gray-400">
              当前暂无可展示的重点事件。
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {focusEvents.map((event, index) => {
                const latestNews = event.latestNews;

                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="group flex min-h-[390px] flex-col border border-gray-700 bg-white p-6 text-black transition hover:-translate-y-1 hover:border-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-black px-2 py-1 text-[10px] font-black tracking-widest text-white">
                          TOP {index + 1}
                        </span>

                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          {safeText(event.category, "AI产业")}
                        </span>
                      </div>

                      <span className="text-xs font-bold text-gray-500">
                        {getScoreLabel(event.focusScore)}
                      </span>
                    </div>

                    <h3 className="mt-6 line-clamp-3 text-xl font-black leading-8 tracking-tight">
                      {event.title}
                    </h3>

                    <div className="mt-6 border-l-2 border-black pl-4">
                      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                        最新动态
                      </div>

                      <div className="mt-2 line-clamp-3 text-sm font-bold leading-6">
                        {latestNews?.title ||
                          safeText(event.summary, "暂无最新动态")}
                      </div>

                      {latestNews && (
                        <div className="mt-2 text-xs text-gray-500">
                          {formatDate(latestNews.publishedAt ?? latestNews.createdAt)} ·{" "}
                          {safeText(latestNews.source, "AI情报源")}
                        </div>
                      )}
                    </div>

                    <p className="mt-5 text-sm leading-6 text-gray-600">
                      {getTrendLabel(
                        event.recent24h,
                        event.recent72h,
                        latestNews?.title
                      )}
                    </p>

                    <div className="mt-auto flex items-center justify-between border-t border-gray-200 pt-5">
                      <div className="flex gap-4 text-xs font-bold text-gray-500">
                        <span>24h {event.recent24h}</span>
                        <span>72h {event.recent72h}</span>
                        <span>热度 {Math.round(event.heatScore)}</span>
                      </div>

                      <span className="text-sm font-black group-hover:translate-x-1 transition-transform">
                        查看事件 →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================
          最新产业情报
      ============================================================ */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                LATEST INTELLIGENCE
              </div>

              <h2 className="text-2xl font-black">最新产业情报</h2>
            </div>

            <Link
              href="/news"
              className="text-sm font-bold underline underline-offset-4"
            >
              全部资讯 →
            </Link>
          </div>

          <div className="divide-y divide-gray-200 border-y border-black">
            {displayLatestNews.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                暂无最新产业情报。
              </div>
            ) : (
              displayLatestNews.map((item) => (
                <Link
                  key={item.id}
                  href={`/news/${item.id}`}
                  className="group grid gap-4 py-5 transition hover:bg-gray-50 lg:grid-cols-[130px_1fr_150px]"
                >
                  <div className="text-xs font-bold text-gray-400">
                    <div>{formatDate(item.publishedAt ?? item.createdAt)}</div>
                    <div className="mt-1">{getTimeAgo(item.publishedAt ?? item.createdAt)}</div>
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="bg-gray-100 px-2 py-1 text-[10px] font-bold tracking-wider text-gray-600">
                        {safeText(item.category, "AI资讯")}
                      </span>

                      {item.aiScore > 0 && (
                        <span className="text-[10px] font-bold text-gray-400">
                          AI SCORE {Math.round(item.aiScore)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold leading-7 group-hover:underline">
                      {item.title}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500">
                      {safeText(item.summary, "暂无摘要")}
                    </p>
                  </div>

                  <div className="text-right text-xs font-semibold text-gray-400">
                    {safeText(item.source, "未知来源")}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
          产业链 / 商业机会
      ============================================================ */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                BUSINESS OPPORTUNITY
              </div>

              <h2 className="text-2xl font-black">产业链 · 商业机会</h2>

              <p className="mt-2 text-sm text-gray-500">
                从产业趋势中提炼可关注的业务方向。
              </p>
            </div>

            <Link
              href="/opportunity-map"
              className="text-sm font-bold underline underline-offset-4"
            >
              查看机会地图 →
            </Link>
          </div>

          {opportunities.length === 0 ? (
            <div className="border border-gray-300 bg-white p-8 text-center text-gray-500">
              当前暂无商业机会数据。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {opportunities.map((item) => (
                <Link
                  key={item.id}
                  href="/opportunity-map"
                  className="group border border-gray-200 bg-white p-6 transition hover:border-black hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-400">
                      {safeText(item.industry, "AI产业")}
                    </span>

                    <span className="text-xs font-bold text-gray-400">
                      {safeText(item.direction, "观察")}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-black leading-7 group-hover:underline">
                    {safeText(item.opportunity, "产业机会")}
                  </h3>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-500">
                    {safeText(item.description, "暂无机会描述")}
                  </p>

                  <div className="mt-5 border-t border-gray-100 pt-4 text-xs font-bold text-gray-400">
                    趋势：{safeText(item.trend, "持续观察")}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================
          投资观察
      ============================================================ */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                INVESTMENT WATCH
              </div>

              <h2 className="text-2xl font-black">投资观察</h2>

              <p className="mt-2 text-sm text-gray-500">
                从商业、技术、市场、成长与风险多个维度观察AI方向。
              </p>
            </div>

            <Link
              href="/investment"
              className="text-sm font-bold underline underline-offset-4"
            >
              查看投资观察 →
            </Link>
          </div>

          {investments.length === 0 ? (
            <div className="border border-gray-200 p-8 text-center text-gray-500">
              当前暂无投资观察数据。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {investments.map((item) => {
                const totalScore =
                  item.businessScore +
                  item.technologyScore +
                  item.marketScore +
                  item.growthScore;

                return (
                  <Link
                    key={item.id}
                    href="/investment"
                    className="group border border-gray-200 p-6 transition hover:border-black"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          {safeText(item.industry, "AI产业")}
                        </div>

                        <h3 className="mt-2 text-lg font-black group-hover:underline">
                          {item.name}
                        </h3>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-black">
                          {totalScore}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Score
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-500">
                      {safeText(item.description, "暂无投资分析")}
                    </p>

                    <div className="mt-5 grid grid-cols-4 gap-2 border-t border-gray-100 pt-4 text-center">
                      <div>
                        <div className="text-sm font-black">
                          {item.businessScore}
                        </div>
                        <div className="text-[9px] text-gray-400">商业</div>
                      </div>

                      <div>
                        <div className="text-sm font-black">
                          {item.technologyScore}
                        </div>
                        <div className="text-[9px] text-gray-400">技术</div>
                      </div>

                      <div>
                        <div className="text-sm font-black">
                          {item.marketScore}
                        </div>
                        <div className="text-[9px] text-gray-400">市场</div>
                      </div>

                      <div>
                        <div className="text-sm font-black">
                          {item.growthScore}
                        </div>
                        <div className="text-[9px] text-gray-400">成长</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================
          AI产业全景
      ============================================================ */}
      <section className="bg-gray-100">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="mb-8">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
              AI INDUSTRY OVERVIEW
            </div>

            <h2 className="text-2xl font-black">AI产业全景</h2>

            <p className="mt-2 text-sm text-gray-500">
              数据规模、事件活跃度与当前首页情报强度。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-gray-200 bg-white p-6">
              <div className="text-xs font-bold tracking-wider text-gray-400">
                AI资讯
              </div>

              <div className="mt-3 text-4xl font-black">
                {newsCount.toLocaleString()}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                当前有效新闻
              </div>
            </div>

            <div className="border border-gray-200 bg-white p-6">
              <div className="text-xs font-bold tracking-wider text-gray-400">
                AI事件
              </div>

              <div className="mt-3 text-4xl font-black">
                {eventCount.toLocaleString()}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                当前活跃事件
              </div>
            </div>

            <div className="border border-gray-200 bg-white p-6">
              <div className="text-xs font-bold tracking-wider text-gray-400">
                今日重点
              </div>

              <div className="mt-3 text-4xl font-black">
                {focusEvents.length}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                当前重点事件
              </div>
            </div>

            <div className="border border-gray-200 bg-white p-6">
              <div className="text-xs font-bold tracking-wider text-gray-400">
                情报强度
              </div>

              <div className="mt-3 text-4xl font-black">
                {averageScore}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                今日重点平均强度
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER
      ============================================================ */}
      <footer className="border-t border-black bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-xs text-gray-500 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <span className="font-bold text-black">AI Insight Daily</span>
            <span className="mx-2">·</span>
            AI产业情报驾驶舱
          </div>

          <div>
            数据持续采集 · AI分析 · 事件聚合 · 商业机会发现
          </div>
        </div>
      </footer>
    </main>
  );
}
