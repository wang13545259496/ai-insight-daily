import Link from "next/link";
import NewsTitle from "@/components/NewsTitle";
import { prisma } from "@/lib/prisma";
import { buildIndustryMap } from "@/lib/industryMap/aggregate";
import { getTier } from "@/lib/ranking/scoreBreakdown";
import IndustryLayerList from "@/app/components/IndustryLayerList";

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
  const d = clampFuture(date);

  if (!d) {
    return "暂无时间";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
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

  // 钳制后再算差值，避免出现「未来 N 小时」这类无意义结果
  const clamped = clampFuture(date);

  if (!clamped) return "";

  const diff = Date.now() - clamped.getTime();

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
  const title = latestNewsTitle || "";

  if (recent24h > 0) {
    if (/融资|投资|资本|收购|上市/.test(title)) {
      return "资本市场出现新信号，关注商业化推进节奏。";
    }

    if (/发布|推出|上线|模型|产品/.test(title)) {
      return "产品与技术方向出现新进展，产业落地持续推进。";
    }

    if (/OpenAI|Anthropic|Google|微软|Meta|百度|阿里|腾讯/.test(title)) {
      return "头部企业持续释放动作，行业竞争格局正在变化。";
    }

    return "近期出现新增动态，产业影响正在持续扩散。";
  }

  if (recent72h >= 2) {
    return "多条信息持续汇聚，该方向热度仍在上升。";
  }

  if (recent72h === 1) {
    return "已有相关进展，持续观察后续产业影响。";
  }

  return "暂无近期动态，作为长期产业趋势观察。";
}

function getScoreLabel(score: number) {
  if (score >= 220) return "高关注";
  if (score >= 160) return "重点";
  if (score >= 100) return "关注";
  return "观察";
}


function getEventTypeLabel(type: string | null | undefined) {

  const map: Record<string,string> = {

    agent: "AI智能体",

    model: "大模型",

    company: "企业动态",

    product: "产品发布",

    investment: "投融资",

    safety: "AI安全",

    policy: "政策治理",

    research: "技术研究",

    application: "产业应用",

  };


  return map[type ?? ""] ?? "AI事件";

}

function safeText(value: string | null | undefined, fallback: string) {
  const text = value?.trim();

  if (!text) return fallback;

  return text.length > 220 ? text.slice(0, 220) + "…" : text;
}


function cleanEventTitle(title: string | null | undefined) {

  if (!title) {
    return "AI产业事件";
  }

  return title
    .replace(/^News\s*[—-]\\s*/i, "")
    .replace(/^Newsroom\s*[\\—-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

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
  ] = await Promise.all([
    prisma.newsEvent.findMany({
      where: {
        status: "active",
        // 只取产业相关事件：eventType 由 lib/intelligence/refreshEvents.ts
        // 依据 lib/ranking/industryScore.ts 的合格性判定写入
        // （industry = 产业相关，filtered = 单篇弱信号或学术占比过高）。
        // industryScore 下限与 industryScore 模块的 minScore 保持一致。
        eventType: "industry",
        industryScore: { gte: 60 },
      },
      select: {
        // 标量字段必须显式列出：使用 select 后，未列出的字段不会返回，
        // 而下方 filter 与渲染逻辑会读取它们。
        id: true,
        title: true,
        summary: true,
        keywords: true,
        category: true,
        heatScore: true,
        peakScore: true,
        trendStatus: true,
        trendSummary: true,
        eventType: true,
        qualityScore: true,
        industryScore: true,
        createdAt: true,
        updatedAt: true,
        news: {
          where: {
            dataStatus: "active",
          },
          // 时间与排序字段都要取：下方按 publishedAt ?? createdAt 判断新近度
          select: {
            id: true,
            title: true,
            // 中文标题：英文来源由回填脚本生成，页面优先显示它
            titleZh: true,
            summary: true,
            source: true,
            sourceUrl: true,
            publishedAt: true,
            createdAt: true,
            aiScore: true,
            category: true,
          },
          orderBy: {
            publishedAt: "desc",
          },
          take: 20,
        },
      },
      orderBy: [
        {
          industryScore: "desc",
        },
        {
          heatScore: "desc",
        },
      ],
      take: 200,
    }),

    prisma.news.findMany({
      where: {
        dataStatus: "active",
        content: {
          not: "",
        },
        aiScore: {
          gte: 40,
        },
      },
      orderBy: [
        {
          publishedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 6,
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
        (item: any) => new Date(item.publishedAt ?? item.createdAt).getTime() >= last72h.getTime()
      );

      const recent24News = recentNews.filter(
        (item: any) => new Date(item.publishedAt ?? item.createdAt).getTime() >= last24h.getTime()
      );

      const latestNews = recentNews[0] ?? null;

      const latestTime = latestNews
        ? new Date(latestNews.publishedAt ?? latestNews.createdAt).getTime()
        : 0;

      const recentAiScore = latestNews?.aiScore ?? 0;

      const recent24h = recent24News.length;
      const recent72h = recentNews.length;

      /*
       * 今日重点排序分。
       *
       * industryScore 是主排序依据——它由 lib/ranking/industryScore.ts 计算，
       * 含义是「热度 + 企业权重 + 商业价值 + 投资价值 − 学术噪声」，
       * 已包含 heatScore 与质量维度，因此权重最高。
       *
       * 后面的 recent24h / recent72h 用于保证「今天有新动态」的事件优先，
       * 避免老事件靠历史积累长期霸榜。
       */
      const focusScore =
        event.industryScore * 1.15 +
        recent24h * 100 +
        recent72h * 25 +
        recentAiScore * 0.8 +
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
    .map((event) => {
      console.log("BEFORE_FILTER", event.id, event.title, {
        recent24h: event.recent24h,
        recent72h: event.recent72h,
        news: event.news.length,
        heat: event.heatScore,
        quality: event.qualityScore
      });
      return event;
    })
    .filter((event) =>
      /*
       * 产业相关性由 industryScore 模块判定，结果写在 eventType 上
       * （industry = 产业相关，filtered = 单篇弱信号或学术占比过高）。
       * 这样「arXiv 论文」「技术随笔」「品牌联名活动」在入库时就被标记，
       * 不必在此处用标题正则逐个打补丁。
       */
      event.eventType === "industry" &&
      (
        // 产业相关性已由 eventType 保证（单篇事件必须有产业信号），
        // 这里只需确认事件近期仍活跃
        // 必须有近期动态：仅靠历史多篇新闻不构成「今日重点」，
        // 否则多年前的论文会因累计篇数进入焦点位
        event.recent24h > 0 ||
        event.recent72h > 0 ||
        (event.news.length >= 2 && event.heatScore >= 50)
      )
    )
    .map((event) => {
      console.log("FOCUS_EVENT", event.id, event.title, event.recent72h, event.heatScore);
      return event;
    })
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

  console.log("FOCUS_COUNT", focusEvents.length);

  console.log(
    "FINAL_FOCUS",
    focusEvents.map((item) => item.title)
  );

  const focusIds = new Set(focusEvents.map((item) => item.id));

  // 产业链地图数据：按产业层归类近 30 天新闻
  // 分类逻辑见 lib/ranking/industryMap.ts，聚合见 lib/industryMap/aggregate.ts
  const industryMap = await buildIndustryMap();

  const displayLatestNews = latestNews
    .filter((item) => {
      const text = `${item.title} ${item.summary || ""}`;
      return !(
        text.includes("登录") ||
        text.includes("注册") ||
        text.includes("首页")
      );
    })
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
    <main className="min-h-screen bg-white text-black">{/* ============================================================
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
                优先展示近期出现新动态、且仍在持续发展的AI产业事件。
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
                          {getEventTypeLabel(event.eventType)}
                        </span>
                      </div>

                      <span className="text-xs font-bold text-gray-500">
                        {getScoreLabel(event.focusScore)}
                      </span>
                    </div>

                    <h3 className="mt-6 line-clamp-3 text-xl font-black leading-8 tracking-tight">
                      {cleanEventTitle(event.title)}
                    </h3>

                    <div className="mt-6 border-l-2 border-black pl-4">
                      <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                        最新动态
                      </div>

                      <div className="mt-2 text-sm font-bold leading-6">
                        {latestNews ? (
                          <NewsTitle
                            title={latestNews.title}
                            titleZh={latestNews.titleZh}
                          />
                        ) : (
                          safeText(event.summary, "暂无最新动态")
                        )}
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        {latestNews
                          ? `${formatDate(latestNews.publishedAt ?? latestNews.createdAt)} · ${safeText(
                              latestNews.source,
                              "AI情报源"
                            )}`
                          : "暂无最新时间"}
                      </div>
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
                          AI SCORE {Math.round(item.aiScore)} · {getTier(item.aiScore).label}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold leading-7 group-hover:underline">
                      {/*
                        原代码写的是 (item as any).titleCn —— 但 schema 里
                        没有 titleCn 字段（实际是 titleZh），因此 safeText 一直
                        回退到英文 title。这里改为正确的字段名。
                      */}
                      <NewsTitle title={item.title} titleZh={item.titleZh} />
                    </h3>

                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500">
                      {safeText(
                        (item as any).summaryCn,
                        safeText(item.summary, "暂无摘要")
                      )
                        .replace(/\s+/g, " ")
                        .replace(/(.{20,})\1+/g, "$1")
                        .trim()}
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

      {/* ---------- 产业链总览 ---------- */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-2xl font-black">产业链总览</h2>
              <p className="mt-2 text-sm text-gray-500">
                上述情报按产业层级的分布，近 {industryMap.windowDays} 天共 {industryMap.total} 条。
              </p>
            </div>
            <div className="text-xs text-gray-400">
              {new Date(industryMap.rangeStart).toLocaleDateString("zh-CN")} —{" "}
              {new Date(industryMap.rangeEnd).toLocaleDateString("zh-CN")}
            </div>
          </div>

          {industryMap.total === 0 ? (
            <p className="text-sm text-gray-500">当前时间窗口内暂无产业动态。</p>
          ) : (
            <>
              <IndustryLayerList layers={industryMap.layers} />

              {industryMap.capital.length > 0 && (
                <div className="mt-6 border border-gray-200 bg-white">
                  <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
                    <h3 className="text-sm font-bold">资本动态</h3>
                    <span className="text-xs text-gray-400">融资、并购、估值</span>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {industryMap.capital.slice(0, 5).map((c) => (
                      <li key={c.id} className="flex items-baseline gap-3 px-5 py-2.5 text-sm">
                        <span className="shrink-0 text-xs text-gray-400 tabular-nums">
                          {new Date(c.publishedAt).toLocaleDateString("zh-CN")}
                        </span>
                        <a href={`/news/${c.id}`} className="line-clamp-1 min-w-0 hover:underline">
                          {c.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
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






      </main>
  );
}
