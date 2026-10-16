import Link from "next/link";
import NewsTitle from "@/components/NewsTitle";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 钳制未来时间。
 *
 * 实测问题：InfoQ 中文 的 RSS 把北京时间标注为 GMT，导致其条目的
 * publishedAt 比真实时刻晚约 8 小时，首页因此显示「未来时间」。
 * 例如显示 2026/10/15 19:05，而当前时刻才 15:44。
 *
 * 处理方式：时间晚于当前时刻时按当前时刻返回。
 * 不修改数据库中的原始值——无法确定源站的真实偏移量，
 * 入库时改写会永久污染数据，且此钳制对未来出现的其它源同样有效。
 */
function clampFuture(date: Date | string | null | undefined, now = Date.now()): Date | null {
  if (!date) return null;

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return null;

  return d.getTime() > now ? new Date(now) : d;
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "暂无时间";

  // 钳制未来时间（InfoQ 把北京时间标成 GMT，见 clampFuture 说明）
  const value = clampFuture(date);

  if (!value) {
    return "暂无时间";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function getTrendText(status: string | null | undefined) {
  const value = (status || "").toLowerCase();

  if (
    value.includes("rising") ||
    value.includes("rise") ||
    value.includes("up") ||
    value.includes("上升")
  ) {
    return "上升";
  }

  if (
    value.includes("fall") ||
    value.includes("down") ||
    value.includes("下降")
  ) {
    return "下降";
  }

  return "稳定";
}

function getTrendClass(status: string | null | undefined) {
  const text = getTrendText(status);

  if (text === "上升") {
    return "bg-black text-white border-black";
  }

  if (text === "下降") {
    return "bg-white text-gray-500 border-gray-300";
  }

  return "bg-gray-100 text-gray-600 border-gray-200";
}

export default async function EventsPage() {
  const now = new Date();

  const last24h = new Date(
    now.getTime() - 24 * 60 * 60 * 1000
  );

  const last72h = new Date(
    now.getTime() - 72 * 60 * 60 * 1000
  );

  const events = await prisma.newsEvent.findMany({
    where: {
      status: "active",
    },
    include: {
      news: {
        where: {
          dataStatus: "active",
        },
        orderBy: {
          publishedAt: "desc",
        },
        select: {
          id: true,
          title: true,
          // 中文标题：英文来源由回填脚本生成，页面优先显示它
          titleZh: true,
          source: true,
          createdAt: true,
          publishedAt: true,
          aiScore: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const processedEvents = events
    .map((event) => {
      const recent24News = event.news.filter(
        (item) =>
          new Date(item.publishedAt ?? item.createdAt).getTime() >= last24h.getTime()
      );

      const recent72News = event.news.filter(
        (item) =>
          new Date(item.publishedAt ?? item.createdAt).getTime() >= last72h.getTime()
      );

      const latestNews = recent72News[0] ?? null;

      const latestTime = latestNews
        ? new Date(latestNews.publishedAt ?? latestNews.createdAt).getTime()
        : 0;

      const latestAiScore = latestNews?.aiScore ?? 0;

      const displayScore =
        recent24News.length * 100 +
        recent72News.length * 18 +
        latestAiScore * 0.8 +
        event.qualityScore * 0.65 +
        Math.min(120, event.heatScore * 0.22);

      return {
        ...event,
        recent24Count: recent24News.length,
        recent72Count: recent72News.length,
        latestNews,
        latestTime,
        displayScore,
      };
    })
    .filter((event) => event.recent72Count > 0)
    .sort((a, b) => {
      if (b.recent24Count !== a.recent24Count) {
        return b.recent24Count - a.recent24Count;
      }

      if (b.latestTime !== a.latestTime) {
        return b.latestTime - a.latestTime;
      }

      if (b.displayScore !== a.displayScore) {
        return b.displayScore - a.displayScore;
      }

      return b.heatScore - a.heatScore;
    });

  const totalEvents = events.length;

  const activeRecentEvents = processedEvents.length;

  const eventsWithNew24h = processedEvents.filter(
    (event) => event.recent24Count > 0
  ).length;

  const averageHeat =
    processedEvents.length > 0
      ? Math.round(
          processedEvents.reduce(
            (sum, event) => sum + event.heatScore,
            0
          ) / processedEvents.length
        )
      : 0;

  const displayEvents = processedEvents.slice(0, 30);

  return (
    <main className="min-h-screen bg-white text-black">
      {/* ============================================================
          HEADER
      ============================================================ */}


      {/* ============================================================
          OVERVIEW
      ============================================================ */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-gray-200 bg-white p-6">
              <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                活跃事件
              </div>

              <div className="mt-3 text-4xl font-black">
                {totalEvents.toLocaleString()}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                当前有效事件
              </div>
            </div>

            <div className="border border-gray-200 bg-white p-6">
              <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                72h动态
              </div>

              <div className="mt-3 text-4xl font-black">
                {activeRecentEvents}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                最近72小时仍有动态
              </div>
            </div>

            <div className="border border-gray-200 bg-white p-6">
              <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                24h更新
              </div>

              <div className="mt-3 text-4xl font-black">
                {eventsWithNew24h}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                最近24小时出现新动态
              </div>
            </div>

            <div className="border border-gray-200 bg-white p-6">
              <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                平均热度
              </div>

              <div className="mt-3 text-4xl font-black">
                {averageHeat}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                当前近期事件平均热度
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          EVENT LIST
      ============================================================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="mb-8 flex flex-col gap-3 border-b border-black pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                LIVE EVENT STREAM
              </div>

              <h2 className="text-2xl font-black">
                当前事件
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                排序优先级：24小时新增 → 最新动态 → 情报质量 → 72小时持续性 → 历史热度
              </p>
            </div>

            <div className="text-xs font-bold text-gray-400">
              展示前 {displayEvents.length} 个近期活跃事件
            </div>
          </div>

          {displayEvents.length === 0 ? (
            <div className="border border-gray-200 bg-gray-50 p-12 text-center">
              <div className="text-lg font-black">
                暂无近期活跃事件
              </div>

              <p className="mt-2 text-sm text-gray-500">
                当前没有最近72小时内出现新动态的事件。
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {displayEvents.map((event, index) => {
                const trend = getTrendText(event.trendStatus);
                const latestNews = event.latestNews;

                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="group flex min-h-[390px] flex-col border border-gray-200 bg-white p-6 transition hover:-translate-y-1 hover:border-black hover:shadow-lg"
                  >
                    {/* Top */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-[10px] font-black tracking-widest ${
                            index < 6
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {index < 6 ? `TOP ${index + 1}` : `#${index + 1}`}
                        </span>

                        <span className="text-xs font-bold text-gray-400">
                          {event.category || "AI产业"}
                        </span>
                      </div>

                      <span
                        className={`border px-2 py-1 text-[10px] font-black ${getTrendClass(
                          event.trendStatus
                        )}`}
                      >
                        {trend}
                      </span>
                    </div>

                    {/* Title */}
                    {/*
                      NewsEvent 表没有 titleZh 字段（与 News 表不同）。
                      事件标题由聚类时取首条新闻的标题，因此可能是英文。
                      这里先用原标题；事件标题的翻译是独立事项，见下条注释说明。
                    */}
                    <h3 className="mt-6 text-xl font-black leading-8 tracking-tight">
                      {event.title}
                    </h3>

                    {/* Latest update */}
                    <div className="mt-5 border-l-2 border-black pl-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                        最新动态
                      </div>

                      <div className="mt-2 text-sm font-bold leading-6">
                        {latestNews ? (
                          <NewsTitle
                            title={latestNews.title}
                            titleZh={latestNews.titleZh}
                          />
                        ) : (
                          event.summary
                        )}
                      </div>

                      {latestNews && (
                        <div className="mt-2 text-xs text-gray-400">
                          {formatDate(latestNews.publishedAt ?? latestNews.createdAt)}
                          {latestNews.source
                            ? ` · ${latestNews.source}`
                            : ""}
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <p className="mt-5 line-clamp-3 text-sm leading-6 text-gray-500">
                      {event.summary || "暂无事件摘要"}
                    </p>

                    {/* Stats */}
                    <div className="mt-auto grid grid-cols-4 gap-2 border-t border-gray-100 pt-5">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400">
                          24H
                        </div>

                        <div className="mt-1 text-lg font-black">
                          {event.recent24Count}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-gray-400">
                          72H
                        </div>

                        <div className="mt-1 text-lg font-black">
                          {event.recent72Count}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-gray-400">
                          热度
                        </div>

                        <div className="mt-1 text-lg font-black">
                          {Math.round(event.heatScore)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-gray-400">
                          新闻
                        </div>

                        <div className="mt-1 text-lg font-black">
                          {event.news.length}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                      <span className="text-xs text-gray-400">
                        最新：{" "}
                        {latestNews
                          ? formatDate(latestNews.publishedAt ?? latestNews.createdAt)
                          : "暂无"}
                      </span>

                      <span className="text-sm font-black transition-transform group-hover:translate-x-1">
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
          EVENT CENTER FOOTER
      ============================================================ */}
      <section className="border-t border-black bg-black text-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-500">
                EVENT INTELLIGENCE
              </div>

              <h2 className="mt-2 text-xl font-black">
                从新闻，到事件，再到产业判断
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                AI Insight Daily 将分散的产业新闻聚合为持续演化的事件，
                用最新动态、热度与趋势帮助识别真正值得关注的变化。
              </p>
            </div>

            <Link
              href="/"
              className="w-fit border border-white px-5 py-3 text-sm font-bold transition hover:bg-white hover:text-black"
            >
              返回AI产业驾驶舱 →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
