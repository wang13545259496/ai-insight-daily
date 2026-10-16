import Link from "next/link";
import NewsTitle from "@/components/NewsTitle";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;
  const eventId = Number(id);

  if (!Number.isInteger(eventId)) {
    return <NotFound />;
  }

  const event = await prisma.newsEvent.findUnique({
    where: {
      id: eventId,
    },
    include: {
      news: {
        where: {
          dataStatus: "active",
        },
        orderBy: {
          publishedAt: "desc",
        },
        take: 30,
        include: {
          sourceRef: true,
        },
      },

      /**
       * 关联实体（公司 / 模型 / 产品 / 人物）。
       * 由 scripts/linkEventEntities.ts 分级加权匹配写入，
       * isPrimary 表示该实体是事件主体（出现在事件标题里）。
       */
      entities: {
        where: {
          entity: { status: { not: "merged" } },
        },
        include: {
          entity: {
            select: { id: true, name: true, type: true },
          },
        },
      },
    },
  });

  if (!event) {
    return <NotFound />;
  }

  const news = event.news;

  const newsCount = news.length;

  const sourceNames = Array.from(
    new Set(
      news
        .map((item) => item.source)
        .filter(Boolean)
    )
  );

  const sourceCount = sourceNames.length;

  const latestNews = news[0];

  const latestTime =
    latestNews?.publishedAt ??
    latestNews?.createdAt ??
    event.updatedAt ??
    event.createdAt;

  const now = Date.now();

  const recent24h = news.filter(
    (item) =>
      now - new Date(item.publishedAt ?? item.createdAt).getTime() <= 24 * 60 * 60 * 1000
  ).length;

  const recent72h = news.filter(
    (item) =>
      now - new Date(item.publishedAt ?? item.createdAt).getTime() <= 72 * 60 * 60 * 1000
  ).length;

  const aiScores = news
    .map((item) => Number(item.aiScore || 0))
    .filter((score) => score > 0);

  const averageAiScore =
    aiScores.length > 0
      ? Math.round(
          aiScores.reduce((sum, score) => sum + score, 0) /
            aiScores.length
        )
      : 0;

  const trendLabel = getTrendLabel(event.trendStatus);

  const trendDescription = getTrendDescription({
    trendStatus: event.trendStatus,
    recent24h,
    recent72h,
  });

  const impactText = buildImpactText(event.category);

  const opportunityText = buildOpportunityText(event.category);

  const riskText = buildRiskText(event.category);

  /**
   * 实体排序：主体优先，其次按名称。
   *
   * 顺序在服务端算好，避免在 JSX 里做排序（可读性差且每次渲染重算）。
   */
  const sortedEntities = [...(event.entities ?? [])].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;

    return a.entity.name.localeCompare(b.entity.name, "zh");
  });

  return (
    <main className="min-h-screen bg-white text-black">
      {/* =========================
          顶部导航
      ========================= */}


      {/* =========================
          事件核心驾驶舱
      ========================= */}
      <section className="border-b border-gray-200 bg-black text-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider">
                  EVENT #{event.id}
                </span>

                <span className="border border-white/20 px-3 py-1 text-xs font-bold">
                  {event.category}
                </span>

                <span className="border border-white/20 px-3 py-1 text-xs font-bold">
                  {trendLabel}
                </span>
              </div>

              <h1 className="max-w-5xl text-4xl font-black leading-tight tracking-tight md:text-5xl">
                <NewsTitle title={event.title} titleZh={event.titleZh} />
              </h1>

              <p className="mt-6 max-w-4xl text-base leading-8 text-gray-300">
                {event.summary}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-400">
                <span>
                  最新动态{" "}
                  <strong className="text-white">
                    {formatDateTime(latestTime)}
                  </strong>
                </span>

                <span>
                  最近24h{" "}
                  <strong className="text-white">
                    {recent24h}
                  </strong>{" "}
                  条
                </span>

                <span>
                  最近72h{" "}
                  <strong className="text-white">
                    {recent72h}
                  </strong>{" "}
                  条
                </span>
              </div>

              {/*
                涉及实体。

                排序刻意是「主体优先、其次按名称」——
                主体是事件的核心对象（如某公司发布产品），
                非主体只是被提及。

                标签限制展示数量：关联实体多的事件（如「大模型竞争」）
                可达 40 个，全列出会淹没页面；此处最多 14 个。
              */}
              {sortedEntities.length > 0 && (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">
                      涉及实体
                    </div>

                    <span className="text-xs text-gray-500">
                      共 {sortedEntities.length} 个
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {sortedEntities.slice(0, 14).map((link) => (
                      <Link
                        key={link.entity.id}
                        href={`/entities/${link.entity.id}`}
                        className={
                          link.isPrimary
                            ? "border border-white bg-white px-3 py-1.5 text-xs font-bold text-black transition hover:bg-gray-200"
                            : "border border-white/25 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white hover:text-white"
                        }
                      >
                        {link.entity.name}
                      </Link>
                    ))}

                    {sortedEntities.length > 14 && (
                      <span className="px-3 py-1.5 text-xs text-gray-500">
                        ⋯
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="border border-white/15 bg-white/[0.04] p-6">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">
                EVENT SIGNAL
              </div>

              <div className="mt-6 grid grid-cols-2 gap-px border border-white/10 bg-white/10">
                <Metric
                  label="热度"
                  value={formatScore(event.heatScore)}
                />

                <Metric
                  label="峰值"
                  value={formatScore(event.peakScore)}
                />

                <Metric
                  label="相关新闻"
                  value={String(newsCount)}
                />

                <Metric
                  label="信息来源"
                  value={String(sourceCount)}
                />
              </div>

              <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-5">
                <div>
                  <div className="text-xs text-gray-500">
                    AI平均评分
                  </div>

                  <div className="mt-1 text-3xl font-black">
                    {averageAiScore || "—"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">
                    事件质量
                  </div>

                  <div className="mt-1 text-xl font-black">
                    {formatScore(event.qualityScore)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          事件判断
      ========================= */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">
              EVENT INTELLIGENCE
            </div>

            <h2 className="mt-2 text-2xl font-black">
              事件情报判断
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              基于当前事件关联新闻、更新时间、AI评分与趋势状态形成的展示层判断。
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <InsightCard
              label="趋势判断"
              title={trendLabel}
              text={trendDescription}
            />

            <InsightCard
              label="产业影响"
              title="值得持续跟踪"
              text={impactText}
            />

            <InsightCard
              label="商业机会"
              title="观察应用落地"
              text={opportunityText}
            />
          </div>
        </div>
      </section>

      {/* =========================
          事件时间线
      ========================= */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                EVENT TIMELINE
              </div>

              <h2 className="mt-2 text-2xl font-black">
                新闻证据时间线
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                按最新发生时间排列，展示该事件当前可追踪的信息证据。
              </p>
            </div>

            <div className="text-sm font-bold text-gray-400">
              共 {newsCount} 条
            </div>
          </div>

          {news.length === 0 ? (
            <div className="border border-gray-200 py-16 text-center text-gray-500">
              当前事件暂无有效新闻数据。
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {news.map((item, index) => (
                <article
                  key={item.id}
                  className="group border border-gray-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-black hover:shadow-sm"
                >
                  <div className="grid gap-5 lg:grid-cols-[72px_1fr_auto]">
                    <div className="hidden lg:block">
                      <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                        #{String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="mt-3 text-xs leading-5 text-gray-400">
                        {formatDate(item.publishedAt ?? item.createdAt)}
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 lg:hidden">
                          #{String(index + 1).padStart(2, "0")}
                        </span>

                        <span className="border border-gray-200 px-2 py-1 text-xs font-bold text-gray-600">
                          {item.source || "未知来源"}
                        </span>

                        {item.verified && (
                          <span className="border border-black px-2 py-1 text-xs font-bold">
                            已验证
                          </span>
                        )}

                        {item.aiScore > 0 && (
                          <span className="text-xs font-bold text-gray-400">
                            AI {formatScore(item.aiScore)}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 text-lg font-black leading-7">
                        <Link
                          href={`/news/${item.id}`}
                          className="transition group-hover:underline"
                        >
                          {item.title}
                        </Link>
                      </h3>

                      <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-500">
                        {item.summary ||
                          item.content ||
                          "暂无新闻摘要。"}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
                        <span>
                          发布时间：{formatDateTime(item.publishedAt ?? item.createdAt)}
                        </span>

                        {item.category && (
                          <span>
                            分类：{item.category}
                          </span>
                        )}

                        <span>
                          来源：{item.source || "未知"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 lg:flex-col lg:items-end">
                      <Link
                        href={`/news/${item.id}`}
                        className="border border-black px-4 py-2 text-xs font-black transition hover:bg-black hover:text-white"
                      >
                        查看详情
                      </Link>

                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border border-gray-200 px-4 py-2 text-xs font-black text-gray-600 transition hover:border-black hover:text-black"
                        >
                          原始来源 ↗
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =========================
          风险关注
      ========================= */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                RISK WATCH
              </div>

              <h2 className="mt-2 text-2xl font-black">
                风险关注
              </h2>

              <p className="mt-3 max-w-md text-sm leading-7 text-gray-500">
                事件仍处于动态变化过程中，以下维度适合作为后续跟踪重点。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <RiskCard
                title="技术成熟度"
                text="关注技术能力是否从演示阶段进入稳定应用阶段。"
              />

              <RiskCard
                title="数据与安全"
                text="关注数据权限、隐私、安全与合规要求变化。"
              />

              <RiskCard
                title="商业落地"
                text={riskText}
              />
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          来源与事件信息
      ========================= */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                SOURCE & DATA
              </div>

              <h2 className="mt-2 text-2xl font-black">
                来源与数据
              </h2>
            </div>

            <Link
              href="/events"
              className="text-sm font-black underline underline-offset-4"
            >
              返回全部事件 →
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-4">
            <DataCard
              label="相关新闻"
              value={String(newsCount)}
              description="当前事件关联有效新闻"
            />

            <DataCard
              label="信息来源"
              value={String(sourceCount)}
              description="不同来源数量"
            />

            <DataCard
              label="24h更新"
              value={String(recent24h)}
              description="最近24小时新增动态"
            />

            <DataCard
              label="72h更新"
              value={String(recent72h)}
              description="最近72小时新增动态"
            />
          </div>

          <div className="mt-8 border border-gray-200 bg-gray-50 p-6">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
              SOURCES
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {sourceNames.length > 0 ? (
                sourceNames.map((source) => (
                  <span
                    key={source}
                    className="border border-gray-200 bg-white px-3 py-2 text-sm font-bold"
                  >
                    {source}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">
                  暂无来源信息
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          底部
      ========================= */}
      <footer className="border-t border-gray-200 bg-black text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-8 text-sm md:flex-row md:items-center lg:px-8">
          <div>
            <div className="font-black">
              AI Insight Daily
            </div>

            <div className="mt-1 text-gray-500">
              AI事件情报 · 新闻证据 · 趋势判断
            </div>
          </div>

          <div className="flex gap-5 text-gray-400">
            <Link
              href="/"
              className="transition hover:text-white"
            >
              首页
            </Link>

            <Link
              href="/news"
              className="transition hover:text-white"
            >
              资讯
            </Link>

            <Link
              href="/events"
              className="transition hover:text-white"
            >
              事件中心
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-black p-5">
      <div className="text-xs text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black">
        {value}
      </div>
    </div>
  );
}

function InsightCard({
  label,
  title,
  text,
}: {
  label: string;
  title: string;
  text: string;
}) {
  return (
    <div className="border border-gray-200 bg-white p-6">
      <div className="text-xs font-black uppercase tracking-wider text-gray-400">
        {label}
      </div>

      <h3 className="mt-3 text-xl font-black">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-gray-500">
        {text}
      </p>
    </div>
  );
}

function RiskCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="text-base font-black">
        {title}
      </div>

      <p className="mt-3 text-sm leading-6 text-gray-500">
        {text}
      </p>
    </div>
  );
}

function DataCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="border border-gray-200 bg-white p-6">
      <div className="text-xs font-black uppercase tracking-wider text-gray-400">
        {label}
      </div>

      <div className="mt-3 text-3xl font-black">
        {value}
      </div>

      <div className="mt-2 text-xs leading-5 text-gray-400">
        {description}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
      <div className="w-full max-w-xl border border-gray-200 p-10 text-center">
        <div className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">
          EVENT NOT FOUND
        </div>

        <h1 className="mt-4 text-3xl font-black">
          事件不存在
        </h1>

        <p className="mt-4 text-sm leading-7 text-gray-500">
          当前事件可能已经被清理，或者访问地址无效。
        </p>

        <Link
          href="/events"
          className="mt-7 inline-block bg-black px-6 py-3 text-sm font-black text-white"
        >
          返回事件中心
        </Link>
      </div>
    </main>
  );
}

function getTrendLabel(status: string) {
  switch (status) {
    case "rising":
      return "上升";
    case "falling":
      return "下降";
    case "stable":
      return "稳定";
    default:
      return status || "持续关注";
  }
}

function getTrendDescription({
  trendStatus,
  recent24h,
  recent72h,
}: {
  trendStatus: string;
  recent24h: number;
  recent72h: number;
}) {
  if (recent24h > 0) {
    return `最近24小时仍有 ${recent24h} 条关联动态，事件当前保持活跃，建议继续关注后续信息变化。`;
  }

  if (recent72h > 0) {
    return `最近72小时仍有 ${recent72h} 条关联动态，但最近24小时暂无新增信息，当前处于持续跟踪阶段。`;
  }

  if (trendStatus === "falling") {
    return "事件近期新增信息减少，关注度可能正在回落。";
  }

  if (trendStatus === "stable") {
    return "事件近期保持相对稳定，建议继续观察后续新增信息。";
  }

  return "当前事件仍具有持续跟踪价值，建议结合后续新闻与来源变化判断趋势。";
}

function buildImpactText(category: string) {
  if (!category) {
    return "关注模型、Agent、应用与企业服务等方向可能出现的连锁变化。";
  }

  return `当前事件属于「${category}」方向，重点关注技术产品、产业链参与者与应用场景是否出现进一步变化。`;
}

function buildOpportunityText(category: string) {
  if (!category) {
    return "重点观察新产品、新服务、企业智能化与行业解决方案的落地机会。";
  }

  return `围绕「${category}」方向，重点观察产品创新、企业服务、应用工具以及行业解决方案等商业化机会。`;
}

function buildRiskText(category: string) {
  if (category === "AI芯片") {
    return "关注供应链、性能兑现、成本结构与规模化部署难度。";
  }

  if (category === "AI模型") {
    return "关注模型能力兑现、推理成本、竞争格局与产品商业化速度。";
  }

  if (category === "AI智能体" || category === "AI Agent") {
    return "关注稳定性、权限控制、数据安全与真实工作流落地成本。";
  }

  return `围绕「${category || "当前方向"}」持续观察技术兑现、竞争格局与商业化成本。`;
}

function formatScore(value: number | null | undefined) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}

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

function formatDate(value: Date | string) {
  // 钳制未来时间（见 clampFuture 说明）
  return (clampFuture(value) ?? new Date(value)).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value: Date | string) {
  // 钳制未来时间（见 clampFuture 说明）
  return (clampFuture(value) ?? new Date(value)).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
