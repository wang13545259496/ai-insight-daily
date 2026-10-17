import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OpportunityMapPage() {
  const [opportunities, investmentCount, eventCount, newsCount] =
    await Promise.all([
      prisma.businessOpportunity.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      }),

      prisma.investment.count(),

      prisma.newsEvent.count({
        where: {
          status: "active",
        },
      }),

      prisma.news.count({
        where: {
          dataStatus: "active",
        },
      }),
    ]);

  const industries = Array.from(
    new Set(
      opportunities
        .map((item) => item.industry)
        .filter(Boolean),
    ),
  );

  const directionStats = new Map<
    string,
    {
      name: string;
      count: number;
      industries: Set<string>;
    }
  >();

  for (const item of opportunities) {
    const direction = item.direction || "观察";

    if (!directionStats.has(direction)) {
      directionStats.set(direction, {
        name: direction,
        count: 0,
        industries: new Set<string>(),
      });
    }

    const current = directionStats.get(direction)!;
    current.count += 1;

    if (item.industry) {
      current.industries.add(item.industry);
    }
  }

  const directions = Array.from(directionStats.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const trendStats = new Map<string, number>();

  for (const item of opportunities) {
    const trend = item.trend || "观察";

    trendStats.set(
      trend,
      (trendStats.get(trend) || 0) + 1,
    );
  }

  const topTrends = Array.from(trendStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topOpportunities = opportunities.slice(0, 12);

  const leadingOpportunity = topOpportunities[0];

  return (
    <div className="min-h-screen bg-white text-black">


      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <section className="border-b border-zinc-200 pb-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-semibold tracking-[0.28em] text-zinc-600">
                BUSINESS OPPORTUNITY INTELLIGENCE
              </div>

              <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
                AI商业机会地图
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600">
                从AI产业趋势、热点事件和市场变化中识别值得关注的商业机会，
                建立从产业信号到创业方向的决策视图。
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/industry"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-300 px-5 text-sm font-semibold transition hover:border-black"
              >
                产业分析
              </Link>

              <Link
                href="/investment"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                投资观察 →
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 md:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="OPPORTUNITIES"
              value={opportunities.length}
            />

            <StatCard
              label="INDUSTRIES"
              value={industries.length}
            />

            <StatCard
              label="DIRECTIONS"
              value={directions.length}
            />

            <StatCard
              label="ACTIVE EVENTS"
              value={eventCount}
            />

            <StatCard
              label="INVESTMENTS"
              value={investmentCount}
            />
          </div>
        </section>

        <section className="py-10">
          <div className="mb-6">
            <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
              OPPORTUNITY SIGNAL
            </div>

            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              当前商业机会信号
            </h2>
          </div>

          {leadingOpportunity ? (
            <div className="rounded-3xl bg-black p-7 text-white md:p-9">
              <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
                      {leadingOpportunity.industry}
                    </span>

                    <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                      {leadingOpportunity.direction}
                    </span>

                    <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                      {leadingOpportunity.trend}
                    </span>
                  </div>

                  <h2 className="mt-6 text-3xl font-bold leading-tight md:text-4xl">
                    {leadingOpportunity.opportunity}
                  </h2>

                  <p className="mt-5 max-w-2xl leading-8 text-zinc-400">
                    {leadingOpportunity.description ||
                      "当前商业机会正在形成，建议结合产业趋势与市场需求进一步验证。"}
                  </p>

                  <Link
                    href={`/opportunity-map/${leadingOpportunity.id}`}
                    className="mt-7 inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                  >
                    查看机会详情 →
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3 self-start">
                  <DarkMetric
                    label="机会编号"
                    value={`#${leadingOpportunity.id}`}
                  />

                  <DarkMetric
                    label="产业"
                    value={leadingOpportunity.industry || "观察"}
                  />

                  <DarkMetric
                    label="方向"
                    value={leadingOpportunity.direction || "观察"}
                  />

                  <DarkMetric
                    label="趋势"
                    value={leadingOpportunity.trend || "观察"}
                  />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState text="当前暂无商业机会数据。" />
          )}
        </section>

        <section className="border-t border-zinc-200 py-10">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
                OPPORTUNITY RADAR
              </div>

              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                AI机会雷达
              </h2>
            </div>

            <span className="hidden text-sm text-zinc-600 md:block">
              共 {opportunities.length} 个机会节点
            </span>
          </div>

          {topOpportunities.length === 0 ? (
            <EmptyState text="当前暂无机会节点。" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {topOpportunities.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/opportunity-map/${item.id}`}
                  className="group rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-black hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold tracking-[0.18em] text-zinc-600">
                      OPPORTUNITY {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="text-xs text-zinc-600">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium">
                      {item.industry || "AI产业"}
                    </span>

                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs">
                      {item.direction || "观察"}
                    </span>

                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs">
                      {item.trend || "观察"}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-bold leading-7 group-hover:underline">
                    {item.opportunity}
                  </h3>

                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-zinc-600">
                    {item.description ||
                      "暂无详细机会描述。"}
                  </p>

                  <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
                    <span className="text-xs text-zinc-600">
                      节点 #{item.id}
                    </span>

                    <span className="text-sm font-semibold">
                      查看详情 →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 border-t border-zinc-200 py-10 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 p-7">
            <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
              DIRECTION ANALYSIS
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              商业方向分布
            </h2>

            <div className="mt-6 space-y-4">
              {directions.length === 0 ? (
                <div className="text-sm text-zinc-600">
                  暂无方向数据。
                </div>
              ) : (
                directions.map((item, index) => {
                  const width = Math.max(
                    8,
                    Math.round(
                      (item.count /
                        Math.max(
                          directions[0].count,
                          1,
                        )) *
                        100,
                    ),
                  );

                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-zinc-300">
                            {String(index + 1).padStart(2, "0")}
                          </span>

                          <span className="font-semibold">
                            {item.name}
                          </span>
                        </div>

                        <span className="text-zinc-600">
                          {item.count} 个机会
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full bg-black"
                          style={{
                            width: `${width}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-zinc-100 p-7">
            <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
              MARKET DIRECTION
            </div>

            <h2 className="mt-2 text-2xl font-bold">
              市场趋势观察
            </h2>

            <div className="mt-6 space-y-3">
              {topTrends.length === 0 ? (
                <div className="text-sm text-zinc-600">
                  暂无趋势数据。
                </div>
              ) : (
                topTrends.map(([trend, count], index) => (
                  <div
                    key={trend}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-zinc-300">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <span className="font-semibold">
                        {trend}
                      </span>
                    </div>

                    <span className="text-sm text-zinc-600">
                      {count} 个节点
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="py-2 pb-10">
          <div className="rounded-3xl border border-zinc-200 p-7 md:p-9">
            <div className="text-xs font-semibold tracking-[0.24em] text-zinc-600">
              BUSINESS JUDGEMENT
            </div>

            <h2 className="mt-2 text-3xl font-bold">
              商业机会判断
            </h2>

            <p className="mt-5 max-w-4xl leading-8 text-zinc-600">
              当前机会地图的核心价值不是简单罗列创业方向，
              而是观察哪些产业方向正在形成真实需求。
              当产业趋势、热点事件和商业机会同时出现时，
              代表该方向值得进一步研究；如果机会数量增长但缺少持续事件和产业数据支撑，
              则应保持谨慎。
            </p>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              <JudgementCard
                title="需求"
                text="关注企业实际使用场景与付费能力"
              />

              <JudgementCard
                title="竞争"
                text="关注模型能力同质化与平台竞争"
              />

              <JudgementCard
                title="落地"
                text="关注行业解决方案的实施成本"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-black p-8 text-white md:p-10">
          <div className="grid gap-8 md:grid-cols-3">
            <FooterMetric
              label="OPPORTUNITY NODES"
              value={opportunities.length}
              text="当前商业机会"
            />

            <FooterMetric
              label="NEWS SIGNAL"
              value={newsCount}
              text="有效产业新闻"
            />

            <FooterMetric
              label="INVESTMENT WATCH"
              value={investmentCount}
              text="投资观察节点"
            />
          </div>

          <div className="mt-10 flex flex-col justify-between gap-5 border-t border-zinc-800 pt-6 md:flex-row md:items-center">
            <div className="max-w-2xl text-sm leading-7 text-zinc-400">
              商业机会地图根据当前产业数据进行结构化整理，
              用于发现和研究潜在商业方向，不构成投资建议。
            </div>

            <div className="flex gap-4 text-sm">
              <Link
                href="/industry"
                className="font-semibold text-white hover:underline"
              >
                产业分析 →
              </Link>

              <Link
                href="/investment"
                className="font-semibold text-white hover:underline"
              >
                投资观察 →
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-col justify-between gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-600 md:flex-row">
          <span>
            AI INSIGHT DAILY · BUSINESS OPPORTUNITY INTELLIGENCE
          </span>

          <span>
            数据节点：新闻 {newsCount} · 事件 {eventCount} · 投资 {investmentCount}
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
  return (
    <div className="bg-white p-5">
      <div className="text-[12px] sm:text-[10px] font-semibold tracking-[0.18em] text-zinc-600">
        {label}
      </div>

      <div className="mt-3 text-3xl font-bold tracking-tight">
        {value.toLocaleString("zh-CN")}
      </div>
    </div>
  );
}

function DarkMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 p-4">
      <div className="text-[12px] sm:text-[10px] tracking-[0.16em] text-zinc-600">
        {label}
      </div>

      <div className="mt-2 break-words text-sm font-bold text-white">
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="text-xs font-semibold tracking-[0.12em] text-zinc-600">
        {title}
      </div>

      <div className="mt-3 text-sm font-semibold leading-6">
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

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-8 text-sm text-zinc-600">
      {text}
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
