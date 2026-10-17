import Link from "next/link";
import NewsTitle from "@/components/NewsTitle";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DIRECTION_RULES = [
  {
    name: "AI智能体",
    keywords: ["agent", "智能体", "代理", "autonomous", "workflow", "copilot"],
  },
  {
    name: "AI大模型",
    keywords: ["大模型", "模型", "llm", "gpt", "claude", "gemini", "deepseek"],
  },
  {
    name: "AI编程",
    keywords: ["编程", "代码", "coding", "developer", "开发工具", "代码助手"],
  },
  {
    name: "AI机器人",
    keywords: ["机器人", "robot", "humanoid", "人形", "具身智能"],
  },
  {
    name: "多模态AI",
    keywords: ["多模态", "multimodal", "视觉", "语音", "image", "video"],
  },
  {
    name: "AI芯片",
    keywords: ["芯片", "gpu", "npu", "算力", "半导体", "accelerator"],
  },
  {
    name: "AI应用",
    keywords: ["应用", "app", "搜索", "办公", "营销", "客服"],
  },
  {
    name: "AI安全",
    keywords: ["安全", "security", "网络攻击", "防御", "隐私"],
  },
];

function containsKeyword(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function getDirection(text: string) {
  for (const rule of DIRECTION_RULES) {
    if (rule.keywords.some((keyword) => containsKeyword(text, keyword))) {
      return rule.name;
    }
  }

  return "其他AI产业";
}

function formatTime(date: Date | null) {
  if (!date) return "暂无";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDate(date: Date | null) {
  if (!date) return "暂无";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function IndustryPage() {
  const now = Date.now();
  const day24 = new Date(now - 24 * 60 * 60 * 1000);
  const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    newsCount,
    eventCount,
    trendCount,
    opportunityCount,
    investmentCount,
    recentNews,
    recentEvents,
    opportunities,
    investments,
  ] = await Promise.all([
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

    prisma.industryTrend.count(),

    prisma.businessOpportunity.count(),

    prisma.investment.count(),

    prisma.news.findMany({
      where: {
        dataStatus: "active",
        publishedAt: {
          gte: day30,
        },
      },
      select: {
        id: true,
        title: true,
        // 中文标题：英文来源由回填脚本生成，页面优先显示它
        titleZh: true,
        category: true,
        summary: true,
        aiScore: true,
        createdAt: true,
        publishedAt: true,
        event: {
          select: {
            id: true,
            title: true,
            heatScore: true,
            trendStatus: true,
          },
        },
      },
      orderBy: {
        publishedAt: "desc",
      },
      take: 3000,
    }),

    prisma.newsEvent.findMany({
      where: {
        status: "active",
      },
      select: {
        id: true,
        title: true,
        // 中文标题：事件标题可能取自英文新闻，由回填脚本生成中文
        titleZh: true,
        category: true,
        summary: true,
        heatScore: true,
        qualityScore: true,
        trendStatus: true,
        updatedAt: true,
        news: {
          where: {
            dataStatus: "active",
            publishedAt: {
              gte: day7,
            },
          },
          select: {
            id: true,
            createdAt: true,
            publishedAt: true,
            aiScore: true,
          },
        },
      },
      orderBy: {
        heatScore: "desc",
      },
      take: 100,
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

  const recent24News = recentNews.filter(
    (item) => (item.publishedAt ?? item.createdAt) >= day24,
  );

  const recent7News = recentNews.filter(
    (item) => (item.publishedAt ?? item.createdAt) >= day7,
  );

  const averageAiScore =
    recentNews.length > 0
      ? Math.round(
          recentNews.reduce(
            (sum, item) => sum + (item.aiScore || 0),
            0,
          ) / recentNews.length,
        )
      : 0;

  const directions = DIRECTION_RULES.map((rule) => {
    const directionNews = recent7News.filter((item) => {
      const text = `${item.title} ${item.category} ${item.summary || ""}`;
      return rule.keywords.some((keyword) =>
        containsKeyword(text, keyword),
      );
    });

    const recent24 = directionNews.filter(
      (item) => (item.publishedAt ?? item.createdAt) >= day24,
    );

    const avgScore =
      directionNews.length > 0
        ? directionNews.reduce(
            (sum, item) => sum + (item.aiScore || 0),
            0,
          ) / directionNews.length
        : 0;

    const heat = Math.min(
      100,
      Math.round(
        Math.min(65, directionNews.length * 2.5) +
          Math.min(20, recent24.length * 5) +
          Math.min(15, avgScore / 7),
      ),
    );

    return {
      name: rule.name,
      count: directionNews.length,
      recent24: recent24.length,
      avgScore: Math.round(avgScore),
      heat,
    };
  })
    .sort((a, b) => {
      if (b.heat !== a.heat) return b.heat - a.heat;
      return b.count - a.count;
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const leadingDirection = directions[0];

  const activeRecentEvents = recentEvents
    .map((event) => {
      const eventRecent24 = event.news.filter(
        (item) => (item.publishedAt ?? item.createdAt) >= day24,
      ).length;

      const eventRecent7 = event.news.length;

      const latestNewsTime =
        event.news.length > 0
          ? Math.max(
              ...event.news.map((item) => item.createdAt.getTime()),
            )
          : 0;

      const score =
        eventRecent24 * 1000 +
        eventRecent7 * 30 +
        event.qualityScore * 0.5 +
        event.heatScore * 0.2;

      return {
        ...event,
        eventRecent24,
        eventRecent7,
        latestNewsTime,
        displayScore: score,
      };
    })
    .filter((event) => event.eventRecent7 > 0)
    .sort((a, b) => {
      if (b.eventRecent24 !== a.eventRecent24) {
        return b.eventRecent24 - a.eventRecent24;
      }

      if (b.latestNewsTime !== a.latestNewsTime) {
        return b.latestNewsTime - a.latestNewsTime;
      }

      return b.displayScore - a.displayScore;
    })
    .slice(0, 5);

  const trendStatus =
    leadingDirection && leadingDirection.recent24 > 0
      ? "上升"
      : "观察";

  return (
    <div className="min-h-screen bg-white text-black">


      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <section className="border-b border-zinc-200 pb-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <div className="mb-4 text-xs font-semibold tracking-[0.28em] text-zinc-600">
                INDUSTRY INTELLIGENCE
              </div>

              <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
                AI产业智能分析中心
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600">
                从新闻、事件、趋势到商业机会与投资方向，
                对当前AI产业进行统一的数据化观察。
              </p>
            </div>

            <Link
              href="/trend"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              查看趋势分析 →
            </Link>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="ACTIVE NEWS" value={newsCount} />
            <StatCard label="ACTIVE EVENTS" value={eventCount} />
            <StatCard label="TREND NODES" value={trendCount} />
            <StatCard label="24H NEWS" value={recent24News.length} />
            <StatCard label="7D NEWS" value={recent7News.length} />
            <StatCard label="OPPORTUNITIES" value={opportunityCount} />
          </div>
        </section>

        <section className="py-10">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
                INDUSTRY RADAR
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                AI产业方向排行榜
              </h2>
            </div>

            <div className="hidden text-right text-sm text-zinc-600 md:block">
              <div>近30天有效新闻 {recentNews.length}</div>
              <div className="mt-1">
                平均AI评分 {averageAiScore}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {directions.map((item) => (
              <DirectionRow
                key={item.name}
                rank={item.rank}
                name={item.name}
                heat={item.heat}
                count={item.count}
                recent24={item.recent24}
                avgScore={item.avgScore}
              />
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-black p-7 text-white md:p-9">
          <div className="flex flex-col justify-between gap-8 lg:flex-row">
            <div>
              <div className="text-xs font-semibold tracking-[0.24em] text-zinc-400">
                LEADING INDUSTRY SIGNAL
              </div>

              <h2 className="mt-3 text-3xl font-bold">
                {leadingDirection?.name || "暂无方向"}
              </h2>

              <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
                当前产业数据中，该方向拥有最高综合热度。
                综合参考近7天新闻活跃度、24小时新增信号以及AI分析评分。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DarkMetric
                label="HEAT"
                value={leadingDirection?.heat ?? 0}
              />
              <DarkMetric
                label="7D NEWS"
                value={leadingDirection?.count ?? 0}
              />
              <DarkMetric
                label="24H"
                value={leadingDirection?.recent24 ?? 0}
              />
              <DarkMetric
                label="STATUS"
                value={trendStatus}
              />
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
                EVENT DRIVEN INDUSTRY
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                热点事件驱动
              </h2>
            </div>

            <Link
              href="/events"
              className="text-sm font-semibold hover:underline"
            >
              查看全部事件 →
            </Link>
          </div>

          {activeRecentEvents.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 p-8 text-zinc-600">
              当前暂无最近7天有效产业事件。
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {activeRecentEvents.map((event, index) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="group rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-black hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold tracking-[0.18em] text-zinc-600">
                      TOP {index + 1}
                    </span>

                    <span className="text-xs text-zinc-600">
                      {formatTime(
                        event.news.length > 0
                          ? new Date(
                              Math.max(
                                ...event.news.map((item) =>
                                  item.createdAt.getTime(),
                                ),
                              ),
                            )
                          : event.updatedAt,
                      )}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-bold leading-7 group-hover:underline">
                    <NewsTitle title={event.title} titleZh={event.titleZh} />
                  </h3>

                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600">
                    {event.summary || "暂无事件摘要"}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-zinc-100 px-3 py-1">
                      {event.category}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1">
                      {event.trendStatus || "观察"}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1">
                      7D {event.eventRecent7}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1">
                      热度 {Math.round(event.heatScore)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-zinc-200 py-10">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
                BUSINESS OPPORTUNITY
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                产业商业机会
              </h2>
            </div>

            <Link
              href="/opportunity-map"
              className="text-sm font-semibold hover:underline"
            >
              进入机会地图 →
            </Link>
          </div>

          {opportunities.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 p-8 text-zinc-600">
              当前暂无已记录的商业机会。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {opportunities.map((item) => (
                <Link
                  key={item.id}
                  href="/opportunity-map"
                  className="rounded-2xl border border-zinc-200 p-6 transition hover:border-black"
                >
                  <div className="text-xs font-semibold tracking-[0.16em] text-zinc-600">
                    {item.industry}
                  </div>

                  <h3 className="mt-3 text-lg font-bold">
                    {item.opportunity}
                  </h3>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600">
                    {item.description}
                  </p>

                  <div className="mt-5 flex items-center justify-between text-xs">
                    <span className="font-semibold">
                      {item.direction}
                    </span>
                    <span className="text-zinc-600">
                      {item.trend}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 pb-10 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 p-7">
            <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
              INVESTMENT WATCH
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              投资观察
            </h2>

            <div className="mt-6 space-y-3">
              {investments.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3 last:border-0"
                >
                  <div>
                    <div className="font-semibold">
                      {item.name}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {item.industry}
                    </div>
                  </div>

                  <div className="text-right text-xs text-zinc-600">
                    <div>
                      商业 {item.businessScore}
                    </div>
                    <div className="mt-1">
                      技术 {item.technologyScore}
                    </div>
                  </div>
                </div>
              ))}

              {investments.length === 0 && (
                <div className="text-sm text-zinc-600">
                  当前暂无投资观察数据。
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-zinc-100 p-7">
            <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
              INDUSTRY JUDGEMENT
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              AI产业趋势判断
            </h2>

            <p className="mt-5 leading-8 text-zinc-600">
              当前AI产业观察应重点关注三个变化：
              第一，模型能力正在继续向实际应用迁移；
              第二，智能体与企业工作流正在成为重要落地方向；
              第三，基础设施、企业服务和行业解决方案之间的产业链联系正在增强。
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <JudgementCard
                title="技术"
                text="模型持续演进"
              />
              <JudgementCard
                title="应用"
                text="产业加速落地"
              />
              <JudgementCard
                title="商业"
                text="价值开始分化"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-black p-8 text-white md:p-10">
          <div className="grid gap-8 md:grid-cols-3">
            <FooterMetric
              label="NEWS COVERAGE"
              value={newsCount}
              text="当前有效新闻"
            />
            <FooterMetric
              label="EVENT INTELLIGENCE"
              value={eventCount}
              text="当前活跃事件"
            />
            <FooterMetric
              label="INVESTMENT WATCH"
              value={investmentCount}
              text="当前投资观察"
            />
          </div>

          <div className="mt-10 border-t border-zinc-800 pt-6 text-sm leading-7 text-zinc-400">
            AI产业智能分析中心基于当前新闻、事件、趋势节点、
            商业机会和投资数据进行综合观察。页面指标属于数据分析结果，
            用于产业研究与趋势判断，不构成投资建议。
          </div>
        </section>

        <div className="mt-8 flex flex-col justify-between gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-600 md:flex-row">
          <span>AI INSIGHT DAILY · INDUSTRY INTELLIGENCE</span>
          <span>
            数据更新时间：{formatDate(new Date())}
          </span>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const href =
    label.includes("NEWS")
      ? "/news"
      : label.includes("EVENTS")
      ? "/events"
      : label.includes("TREND")
      ? "/trend"
      : label.includes("OPPORTUNITIES")
      ? "/opportunity-map"
      : "/industry";

  return (
    <Link
      href={href}
      className="bg-white p-5 transition hover:bg-zinc-50"
    >
      <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-600">
        {label}
      </div>

      <div className="mt-3 text-3xl font-bold tracking-tight">
        {value.toLocaleString("zh-CN")}
      </div>

      <div className="mt-2 text-xs text-zinc-600">
        查看详情 →
      </div>
    </Link>
  );
}

function DirectionRow({
  rank,
  name,
  heat,
  count,
  recent24,
  avgScore,
}: {
  rank: number;
  name: string;
  heat: number;
  count: number;
  recent24: number;
  avgScore: number;
}) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(name)}`}
      className="grid items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-black hover:shadow-sm md:grid-cols-[60px_1.4fr_1fr_100px_100px_100px]"
    >
      <div className="text-xl font-bold text-zinc-300">
        {String(rank).padStart(2, "0")}
      </div>

      <div>
        <div className="font-bold group-hover:underline">{name}</div>
        <div className="mt-1 text-xs text-zinc-600">
          点击查看相关产业新闻
        </div>
      </div>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full bg-black"
            style={{ width: `${Math.max(4, heat)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="text-xs text-zinc-600">HEAT</div>
        <div className="mt-1 font-bold">{heat}</div>
      </div>

      <div>
        <div className="text-xs text-zinc-600">7D NEWS</div>
        <div className="mt-1 font-bold">{count}</div>
      </div>

      <div>
        <div className="text-xs text-zinc-600">24H / AI</div>
        <div className="mt-1 font-bold">
          {recent24} / {avgScore}
        </div>
      </div>
    </Link>
  );
}

function DarkMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-[82px] rounded-xl border border-zinc-800 p-4">
      <div className="text-[10px] tracking-[0.16em] text-zinc-600">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold text-white">
        {value}
      </div>
    </div>
  );
}

function JudgementCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-xs font-semibold text-zinc-600">
        {title}
      </div>
      <div className="mt-2 text-sm font-semibold">
        {text}
      </div>
    </div>
  );
}

function FooterMetric({
  label,
  value,
  text,
}: {
  label: string;
  value: number;
  text: string;
}) {
  return (
    <div>
      <div className="text-xs tracking-[0.18em] text-zinc-600">
        {label}
      </div>
      <div className="mt-3 text-4xl font-bold">
        {value.toLocaleString("zh-CN")}
      </div>
      <div className="mt-2 text-sm text-zinc-600">
        {text}
      </div>
    </div>
  );
}
