import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { rankInvestments } from "@/lib/ranking/investmentRanking";
import { calculateInvestmentScore } from "@/lib/scoring/investmentScore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvestmentPage() {
  const investments = await prisma.investment.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      sourceNews: {
        select: {
          id: true,
          title: true,
          source: true,
          sourceUrl: true,
          createdAt: true,
        },
      },
      sourceEvent: {
        select: {
          id: true,
          title: true,
          heatScore: true,
        },
      },
    },
  });

  const ranked = rankInvestments(investments);

  const items = ranked.map((item) => {
    const score = calculateInvestmentScore({
      businessScore: item.businessScore,
      technologyScore: item.technologyScore,
      marketScore: item.marketScore,
      growthScore: item.growthScore,
      riskScore: item.riskScore,
    });

    return {
      ...item,
      calculatedScore: score.score,
      calculatedLevel: score.level,
      calculatedReason: score.reason,
      riskControlScore: 100 - normalize(item.riskScore),
    };
  });

  const topInvestments = items.slice(0, 3);

  const averageScore = average(
    items.map((item) => item.calculatedScore),
  );

  const averageBusiness = average(
    items.map((item) => normalize(item.businessScore)),
  );

  const averageTechnology = average(
    items.map((item) => normalize(item.technologyScore)),
  );

  const averageMarket = average(
    items.map((item) => normalize(item.marketScore)),
  );

  const averageGrowth = average(
    items.map((item) => normalize(item.growthScore)),
  );

  const averageRiskControl = average(
    items.map((item) => 100 - normalize(item.riskScore)),
  );

  const highAttentionCount = items.filter(
    (item) => item.calculatedLevel === "高度关注",
  ).length;

  const continuousObservationCount = items.filter(
    (item) => item.calculatedLevel === "持续观察",
  ).length;

  const focusCount = items.filter(
    (item) => item.calculatedLevel === "重点关注",
  ).length;

  const industryMap = new Map<string, number>();

  for (const item of items) {
    const industry = item.industry?.trim() || "其他";
    industryMap.set(
      industry,
      (industryMap.get(industry) || 0) + 1,
    );
  }

  const industries = Array.from(industryMap.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  const lowerRiskItems = [...items]
    .sort(
      (a, b) =>
        normalize(a.riskScore) - normalize(b.riskScore),
    )
    .slice(0, 5);

  const riskWatchItems = [...items]
    .sort(
      (a, b) =>
        normalize(b.riskScore) - normalize(a.riskScore),
    )
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">

        <section className="mb-10">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-gray-700 px-3 py-1 text-[12px] sm:text-[11px] tracking-[0.18em] text-gray-400">
              AI INDUSTRY INTELLIGENCE
            </span>

            <span className="rounded-full border border-gray-800 px-3 py-1 text-[12px] sm:text-[11px] tracking-[0.18em] text-gray-400">
              INVESTMENT OBSERVATION
            </span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI产业投资观察
          </h1>

          <p className="mt-5 max-w-4xl text-base leading-8 text-gray-400">
            从真实产业新闻、企业案例与产业事件中识别真实 AI
            业务主体，并通过商业、技术、市场、增长与风险五个维度，
            建立持续跟踪的投资观察体系。
          </p>

          <div className="mt-7 rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-200">
                  数据口径
                </div>

                <p className="mt-2 max-w-4xl text-sm leading-7 text-gray-400">
                  本页面展示的是
                  <span className="text-gray-300">
                    AI产业投资观察主体
                  </span>
                  ，而不是已经完成财务尽调、估值验证或实际投资决策的证券或项目。
                  所有主体均需要能够追溯至真实新闻或公开企业案例。
                </p>
              </div>

              <div className="shrink-0 rounded-xl border border-gray-800 px-4 py-3 text-xs text-gray-400">
                {items.length} 个真实观察主体
              </div>
            </div>

            <div className="mt-5 border-t border-gray-900 pt-4 text-xs leading-6 text-gray-400">
              评分用于辅助 AI 产业研究、信息筛选和趋势判断，
              不构成投资建议、买卖建议、估值结论或收益承诺。
            </div>
          </div>
        </section>

        <section className="mb-12">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <StatCard
              label="观察主体"
              value={String(items.length)}
              description="真实 Investment"
            />

            <StatCard
              label="平均评分"
              value={items.length ? String(averageScore) : "--"}
              description="统一投资评分"
            />

            <StatCard
              label="重点关注"
              value={String(focusCount)}
              description="当前最高等级"
            />

            <StatCard
              label="高度关注"
              value={String(highAttentionCount)}
              description="较强观察价值"
            />

            <StatCard
              label="持续观察"
              value={String(continuousObservationCount)}
              description="证据仍需跟踪"
            />

            <StatCard
              label="风险控制"
              value={
                items.length
                  ? String(averageRiskControl)
                  : "--"
              }
              description="平均风险控制分"
            />
          </div>
        </section>

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <section className="mb-12">
              <SectionHeader
                eyebrow="TOP OBSERVATIONS"
                title="重点投资观察"
                description="按照统一投资评分排序，优先展示当前公开证据相对完整、产业价值较高的真实主体。"
              />

              <div className="grid gap-5 lg:grid-cols-3">
                {topInvestments.map((item, index) => (
                  <InvestmentCard
                    key={item.id}
                    item={item}
                    rank={index + 1}
                  />
                ))}
              </div>
            </section>

            <section className="mb-12">
              <SectionHeader
                eyebrow="INVESTMENT RADAR"
                title="投资观察雷达"
                description="五维指标用于比较不同主体的产业投资观察价值，不代表实际收益概率。"
              />

              {/* 手机上 6 列放不下（主体名会被截断），改为横向滚动。
                  min-w 取 600px：桌面容器更宽，视觉不变；手机上滑动约 1.6 屏。 */}
              <p className="mb-2 text-xs text-gray-500 lg:hidden">
                ← 左右滑动查看五维评分 →
              </p>

              <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    <div className="grid grid-cols-6 border-b border-gray-800 px-5 py-4 text-xs text-gray-400">
                  <div>主体</div>
                  <div>商业</div>
                  <div>技术</div>
                  <div>市场</div>
                  <div>增长</div>
                  <div>综合</div>
                </div>

                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/investment/${item.id}`}
                    className="grid grid-cols-6 items-center border-b border-gray-900 px-5 py-5 transition last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="truncate font-semibold text-white">
                        {item.name}
                      </div>

                      <div className="mt-1 truncate text-xs text-gray-400">
                        {item.industry}
                      </div>
                    </div>

                    <ScoreCell value={item.businessScore} />
                    <ScoreCell value={item.technologyScore} />
                    <ScoreCell value={item.marketScore} />
                    <ScoreCell value={item.growthScore} />

                    <div>
                      <div className="text-xl font-bold">
                        {item.calculatedScore}
                      </div>

                      <LevelBadge
                        level={item.calculatedLevel}
                      />
                    </div>
                  </Link>
                ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <SectionHeader
                eyebrow="OBSERVATION LIST"
                title="AI产业投资观察名单"
                description="当前数据库中的全部真实投资观察主体。系统不会自动生成虚构公司或模拟投资项目。"
              />

              <div className="space-y-4">
                {items.map((item, index) => (
                  <Link
                    key={item.id}
                    href={`/investment/${item.id}`}
                    className="group block rounded-3xl border border-gray-800 bg-gray-950 p-6 transition hover:border-gray-600"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 gap-5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-800 text-sm font-semibold text-gray-400">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-semibold text-white group-hover:text-gray-300">
                              {item.name}
                            </h3>

                            <LevelBadge
                              level={item.calculatedLevel}
                            />
                          </div>

                          <div className="mt-2 text-sm text-gray-400">
                            {item.industry}
                          </div>

                          <p className="mt-4 max-w-4xl text-sm leading-7 text-gray-400">
                            {item.description}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <MetricTag
                              label="商业"
                              value={item.businessScore}
                            />

                            <MetricTag
                              label="技术"
                              value={item.technologyScore}
                            />

                            <MetricTag
                              label="市场"
                              value={item.marketScore}
                            />

                            <MetricTag
                              label="增长"
                              value={item.growthScore}
                            />

                            <MetricTag
                              label="风险"
                              value={item.riskScore}
                              inverted
                            />
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 border-t border-gray-900 pt-5 lg:border-t-0 lg:pt-0 lg:text-right">
                        <div className="text-xs text-gray-400">
                          综合投资评分
                        </div>

                        <div className="mt-1 text-4xl font-bold">
                          {item.calculatedScore}
                        </div>

                        <div className="mt-2 max-w-xs text-xs leading-5 text-gray-400 lg:ml-auto">
                          {item.calculatedReason}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <SectionHeader
                eyebrow="FIVE DIMENSIONS"
                title="产业投资观察能力"
                description="当前观察池的整体结构，用于判断不同主体的能力侧重点。"
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <DimensionCard
                  label="商业能力"
                  value={averageBusiness}
                  description="商业模式与变现能力"
                />

                <DimensionCard
                  label="技术能力"
                  value={averageTechnology}
                  description="技术能力与产品壁垒"
                />

                <DimensionCard
                  label="市场空间"
                  value={averageMarket}
                  description="潜在市场与需求空间"
                />

                <DimensionCard
                  label="增长潜力"
                  value={averageGrowth}
                  description="业务扩张与增长潜力"
                />

                <DimensionCard
                  label="风险控制"
                  value={averageRiskControl}
                  description="风险因素控制能力"
                />
              </div>
            </section>

            <section className="mb-12">
              <SectionHeader
                eyebrow="INDUSTRY DISTRIBUTION"
                title="投资观察行业分布"
                description="当前真实 Investment 数据在不同 AI 产业方向中的分布。"
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {industries.map(([industry, count]) => (
                  <div
                    key={industry}
                    className="rounded-2xl border border-gray-800 bg-gray-950 p-6"
                  >
                    <div className="text-sm text-gray-400">
                      {industry}
                    </div>

                    <div className="mt-4 text-3xl font-bold">
                      {count}
                    </div>

                    <div className="mt-2 text-xs text-gray-400">
                      个观察主体
                    </div>

                    <div className="mt-5 h-1 overflow-hidden rounded-full bg-gray-900">
                      <div
                        className="h-full rounded-full bg-gray-500"
                        style={{
                          width: `${Math.max(
                            8,
                            Math.round(
                              (count / items.length) * 100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <div className="mb-7">
                  <div className="text-xs tracking-[0.2em] text-gray-400">
                    LOWER RISK
                  </div>

                  <h2 className="mt-2 text-2xl font-semibold">
                    相对低风险观察
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    风险评分越低，当前评分模型中的风险控制得分越高。
                  </p>
                </div>

                <div className="space-y-3">
                  {lowerRiskItems.map((item) => (
                    <RiskRow
                      key={item.id}
                      item={item}
                      showControl
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-6">
                <div className="mb-7">
                  <div className="text-xs tracking-[0.2em] text-gray-400">
                    RISK WATCH
                  </div>

                  <h2 className="mt-2 text-2xl font-semibold">
                    风险重点观察
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    风险评分较高的主体，需要更多公开证据和后续商业验证。
                  </p>
                </div>

                <div className="space-y-3">
                  {riskWatchItems.map((item) => (
                    <RiskRow
                      key={item.id}
                      item={item}
                      showControl={false}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="mb-12 rounded-3xl border border-gray-800 bg-gray-950 p-6">
              <SectionHeader
                eyebrow="EVIDENCE CHAIN"
                title="投资观察证据链"
                description="每一个 Investment 主体都必须能够追溯到真实新闻来源，事件层仅作为辅助产业背景。"
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-900 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {item.name}
                        </div>

                        <div className="mt-1 text-xs text-gray-400">
                          {item.sourceType || "unknown"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {item.calculatedScore}
                        </div>

                        <div className="text-[12px] sm:text-[10px] text-gray-400">
                          SCORE
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-gray-900 pt-4">
                      <div className="text-[12px] sm:text-[11px] text-gray-400">
                        SOURCE NEWS #{item.sourceNewsId}
                      </div>

                      <div className="mt-2 line-clamp-2 text-sm leading-6 text-gray-400">
                        {item.sourceNews?.title ||
                          "暂无来源新闻"}
                      </div>

                      <div className="mt-4 text-[12px] sm:text-[11px] text-gray-400">
                        SOURCE EVENT #{item.sourceEventId}
                      </div>

                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400">
                        {item.sourceEvent?.title ||
                          "暂无来源事件"}
                      </div>

                      {item.sourceNews?.sourceUrl ? (
                        <a
                          href={item.sourceNews.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-5 inline-block text-xs text-gray-400 underline underline-offset-4 transition hover:text-white"
                        >
                          查看原始来源
                        </a>
                      ) : (
                        <div className="mt-5 text-xs text-gray-400">
                          暂无原始来源链接
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12 rounded-3xl border border-gray-800 bg-gray-950 p-6 md:p-8">
              <div className="max-w-4xl">
                <div className="text-xs tracking-[0.2em] text-gray-400">
                  METHODOLOGY
                </div>

                <h2 className="mt-2 text-2xl font-semibold">
                  AI产业投资观察方法
                </h2>

                <div className="mt-6 grid gap-4 md:grid-cols-5">
                  <MethodStep
                    number="01"
                    title="真实新闻"
                    description="从公开产业资讯中获取事实依据。"
                  />

                  <MethodStep
                    number="02"
                    title="主体识别"
                    description="识别真实企业、产品或产业主体。"
                  />

                  <MethodStep
                    number="03"
                    title="证据判断"
                    description="判断公开信息的完整度与可信度。"
                  />

                  <MethodStep
                    number="04"
                    title="投资观察"
                    description="从商业、技术、市场和增长等角度观察。"
                  />

                  <MethodStep
                    number="05"
                    title="持续跟踪"
                    description="通过后续新闻持续更新判断。"
                  />
                </div>
              </div>
            </section>
          </>
        )}

        <section className="border-t border-gray-900 pt-8">
          <div className="flex flex-col gap-3 text-xs leading-6 text-gray-400 md:flex-row md:items-center md:justify-between">
            <div>
              {items.length > 0
                ? `当前基于 ${items.length} 个真实 AI 产业投资观察主体`
                : "当前暂无真实投资观察主体"}
            </div>

            <div>
              AI Insight Daily · AI产业投资观察
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function normalize(value: number | null | undefined): number {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return 0;
  }

  if (value < 0) return 0;
  if (value > 100) return 100;

  return Math.round(value);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) /
      values.length,
  );
}

function EmptyState() {
  return (
    <section className="rounded-3xl border border-gray-800 bg-gray-950 p-10 md:p-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs tracking-[0.2em] text-gray-400">
          INVESTMENT OBSERVATION
        </div>

        <h2 className="mt-4 text-3xl font-semibold">
          当前没有真实投资观察主体
        </h2>

        <p className="mt-5 text-sm leading-7 text-gray-400">
          当前 Investment 数据库没有真实项目。
          系统不会自动生成演示项目、虚构公司或模拟投资标的。
          只有真实新闻经过主体识别、证据判断和投资价值分析后，
          才会进入投资观察池。
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/news"
            className="rounded-xl border border-gray-700 px-5 py-3 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
          >
            查看产业资讯
          </Link>

          <Link
            href="/events"
            className="rounded-xl border border-gray-800 px-5 py-3 text-sm text-gray-400 transition hover:border-gray-600 hover:text-gray-300"
          >
            查看产业事件
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
      <div className="text-xs tracking-wide text-gray-400">
        {label}
      </div>

      <div className="mt-3 text-3xl font-bold">
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {description}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <div className="text-xs tracking-[0.2em] text-gray-400">
        {eyebrow}
      </div>

      <h2 className="mt-2 text-2xl font-semibold">
        {title}
      </h2>

      <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">
        {description}
      </p>
    </div>
  );
}

function InvestmentCard({
  item,
  rank,
}: {
  item: any;
  rank: number;
}) {
  return (
    <Link
      href={`/investment/${item.id}`}
      className="group rounded-3xl border border-gray-800 bg-gray-950 p-6 transition hover:border-gray-600"
    >
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="text-xs tracking-[0.16em] text-gray-400">
            TOP {rank}
          </div>

          <h3 className="mt-3 truncate text-2xl font-bold text-white group-hover:text-gray-300">
            {item.name}
          </h3>

          <div className="mt-2 text-sm text-gray-400">
            {item.industry}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-4xl font-bold">
            {item.calculatedScore}
          </div>

          <LevelBadge level={item.calculatedLevel} />
        </div>
      </div>

      <p className="mt-6 line-clamp-4 text-sm leading-7 text-gray-400">
        {item.description}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <MiniMetric
          label="商业"
          value={item.businessScore}
        />

        <MiniMetric
          label="技术"
          value={item.technologyScore}
        />

        <MiniMetric
          label="市场"
          value={item.marketScore}
        />

        <MiniMetric
          label="增长"
          value={item.growthScore}
        />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-gray-900 pt-4">
        <span className="text-xs text-gray-400">
          来源新闻 #{item.sourceNewsId}
        </span>

        <span className="text-xs text-gray-400 transition group-hover:text-gray-300">
          查看观察 →
        </span>
      </div>
    </Link>
  );
}

function DimensionCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
      <div className="text-sm text-gray-400">
        {label}
      </div>

      <div className="mt-3 text-3xl font-bold">
        {value}
      </div>

      <div className="mt-2 text-xs leading-5 text-gray-400">
        {description}
      </div>

      <div className="mt-5 h-1 rounded-full bg-gray-900">
        <div
          className="h-full rounded-full bg-gray-500"
          style={{
            width: `${Math.max(5, value)}%`,
          }}
        />
      </div>
    </div>
  );
}

function ScoreCell({
  value,
}: {
  value: number;
}) {
  return (
    <div className="text-sm font-medium text-gray-300">
      {normalize(value)}
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-gray-900 p-3">
      <div className="text-xs text-gray-400">
        {label}
      </div>

      <div className="mt-1 text-lg font-semibold">
        {normalize(value)}
      </div>
    </div>
  );
}

function MetricTag({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value: number;
  inverted?: boolean;
}) {
  return (
    <span className="rounded-lg border border-gray-800 px-3 py-1.5 text-xs text-gray-400">
      {label} {normalize(value)}
      {inverted ? " · 越低越好" : ""}
    </span>
  );
}

function LevelBadge({
  level,
}: {
  level: string;
}) {
  return (
    <span className="mt-2 inline-block rounded-full border border-gray-700 px-2.5 py-1 text-[12px] sm:text-[11px] text-gray-400">
      {level}
    </span>
  );
}

function RiskRow({
  item,
  showControl,
}: {
  item: any;
  showControl: boolean;
}) {
  const risk = normalize(item.riskScore);
  const control = 100 - risk;

  return (
    <Link
      href={`/investment/${item.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-gray-900 p-4 transition hover:border-gray-700"
    >
      <div className="min-w-0">
        <div className="font-medium text-white">
          {item.name}
        </div>

        <div className="mt-1 truncate text-xs text-gray-400">
          {item.industry}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-lg font-semibold">
          {showControl ? control : risk}
        </div>

        <div className="text-[12px] sm:text-[11px] text-gray-400">
          {showControl ? "风险控制" : "风险评分"}
        </div>
      </div>
    </Link>
  );
}

function MethodStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-900 p-5">
      <div className="text-xs tracking-[0.15em] text-gray-400">
        {number}
      </div>

      <div className="mt-3 text-sm font-semibold text-gray-300">
        {title}
      </div>

      <p className="mt-2 text-xs leading-5 text-gray-400">
        {description}
      </p>
    </div>
  );
}
