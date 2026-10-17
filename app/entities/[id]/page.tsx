import Link from "next/link";
import { notFound } from "next/navigation";
import NewsTitle from "@/components/NewsTitle";
import {
  buildEntityProfile,
  ENTITY_TYPE_LABELS,
} from "@/lib/entity/entityProfile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await buildEntityProfile(Number(id));

  if (!profile) return { title: "实体不存在 - AI Insight Daily" };

  return {
    title: `${profile.name} - AI Insight Daily`,
    description:
      profile.description ||
      `${profile.name} 相关的事件与动态，共 ${profile.events.length} 个事件。`,
  };
}

/**
 * 事件热度状态的配色。
 *
 * 键必须是**实际存储的中文值** —— 见 lib/intelligence/refreshEvents.ts:115，
 * trendStatus 由 recent24h / recent72h 推导为：
 *   爆发增长 / 快速上升 / 最新动态 / 持续关注 / 热度下降
 *
 * 曾误用英文键（rising / falling / stable），导致全部落到默认值，
 * 19 个「热度下降」被显示成「热度平稳」—— 是错误显示，不只是不好看。
 *
 * 这里**不做兜底**：查不到就原样显示状态值本身。
 * 宁可样式朴素，也不要谎报。
 */
/**
 * 新闻与实体的关系标签。
 *
 * subject    —— 实体出现在新闻标题里，是文章主体
 * background —— 实体出现在正文或摘要里，被提及
 * event      —— 由事件继承而来（当前默认关闭）
 */
const NEWS_ROLE: Record<string, { text: string; cls: string }> = {
  subject: { text: "主体", cls: "bg-black text-white border-black" },
  background: { text: "提及", cls: "bg-gray-50 text-gray-600 border-gray-200" },
  event: { text: "事件", cls: "bg-blue-50 text-blue-700 border-blue-200" },
};

const TREND_STYLE: Record<string, string> = {
  爆发增长: "bg-red-50 text-red-700 border-red-200",
  快速上升: "bg-orange-50 text-orange-700 border-orange-200",
  最新动态: "bg-gray-900 text-white border-gray-900",
  持续关注: "bg-gray-100 text-gray-700 border-gray-200",
  热度下降: "bg-blue-50 text-blue-700 border-blue-200",
};

function formatDate(d: Date | null) {
  if (!d) return null;

  return new Date(d).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const entityId = Number(id);

  if (!Number.isInteger(entityId) || entityId <= 0) notFound();

  const profile = await buildEntityProfile(entityId);

  if (!profile) notFound();

  const { events, coEntities } = profile;

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-black lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/entities"
          className="text-sm text-gray-500 transition hover:text-black"
        >
          ← 返回实体库
        </Link>

        {/* 头部 */}
        <header className="mt-6 border-b border-gray-200 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold tracking-wide text-gray-700">
              {ENTITY_TYPE_LABELS[profile.type] ?? profile.type}
            </span>

            {profile.aliases.length > 0 && (
              <span className="text-xs text-gray-500">
                亦称 {profile.aliases.slice(0, 4).join(" / ")}
              </span>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            {profile.name}
          </h1>

          {profile.description && (
            <p className="mt-3 max-w-3xl text-base leading-8 text-gray-700">
              {profile.description}
            </p>
          )}

          {/* 统计 */}
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-xs text-gray-500">关联事件</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">
                {events.length}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-gray-500">其中作为主体</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">
                {profile.primaryCount}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-gray-500">相关新闻</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">
                {profile.newsCount}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-gray-500">共同出现主体</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums">
                {coEntities.length}
              </dd>
            </div>

            {profile.lastEventAt && (
              <div>
                <dt className="text-xs text-gray-500">最近事件</dt>
                <dd className="mt-1 text-base font-medium">
                  {formatDate(profile.lastEventAt)}
                </dd>
              </div>
            )}
          </dl>
        </header>

        {events.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-8 text-sm text-gray-600">
            该实体目前没有关联的事件。
            {/*
              如实说明而非留空 —— 实体库有 1500 余个实体，
              其中大多数只出现在单篇新闻里，尚未进入任何事件聚类。
              这是数据现状，不是错误。
            */}
            实体来自全部新闻的抽取，但事件聚类只覆盖近期内容，
            因此多数实体暂时没有事件关联。
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
            {/* 左栏：关联事件 */}
            <section className="lg:col-span-8">
              <div className="text-[11px] font-bold tracking-[0.3em] text-gray-500 uppercase">
                RELATED EVENTS
              </div>

              <h2 className="mt-2 text-2xl font-bold">关联事件</h2>

              <div className="mt-6 space-y-4">
                {events.map((ev) => {
                  // 未知状态原样显示，不用默认值掩盖
                  const trendCls = TREND_STYLE[ev.trendStatus] ?? "";

                  return (
                    <Link
                      key={ev.id}
                      href={`/events/${ev.id}`}
                      className="group block rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-gray-900"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {ev.isPrimary && (
                          <span className="rounded-full bg-black px-2.5 py-0.5 text-[10px] font-bold text-white">
                            主体
                          </span>
                        )}

                        {ev.trendStatus && (
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
                              trendCls || "border-gray-200 bg-gray-50 text-gray-600"
                            }`}
                          >
                            {ev.trendStatus}
                          </span>
                        )}

                        <span className="text-xs text-gray-500">
                          产业价值 {Math.round(ev.industryScore)}
                        </span>

                        <span className="text-xs text-gray-600">
                          {ev.newsCount} 篇新闻
                        </span>
                      </div>

                      <h3 className="mt-3 text-base leading-7 font-bold group-hover:underline">
                        {ev.titleZh || ev.title}
                      </h3>
                    </Link>
                  );
                })}
              </div>

              {/* 相关新闻 */}
              {profile.news.length > 0 && (
                <div className="mt-14">
                  <div className="text-[11px] font-bold tracking-[0.3em] text-gray-500 uppercase">
                    RELATED NEWS
                  </div>

                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="text-2xl font-bold">相关新闻</h2>

                    <span className="text-sm text-gray-500">
                      共 {profile.newsCount} 篇，显示最近 {profile.news.length} 篇
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {profile.news.map((n) => {
                      const role = NEWS_ROLE[n.role] ?? NEWS_ROLE.background;

                      return (
                        <li key={n.id}>
                          <Link
                            href={`/news/${n.id}`}
                            className="group block rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-gray-900"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${role.cls}`}
                              >
                                {role.text}
                              </span>

                              {n.source && (
                                <span className="text-xs text-gray-500">{n.source}</span>
                              )}

                              {n.publishedAt && (
                                <span className="text-xs text-gray-600">
                                  {formatDate(n.publishedAt)}
                                </span>
                              )}

                              {n.aiScore > 0 && (
                                <span className="ml-auto text-xs font-bold tabular-nums text-gray-600">
                                  {Math.round(n.aiScore)}
                                </span>
                              )}
                            </div>

                            <h3 className="mt-2.5 text-base leading-7 font-bold group-hover:underline">
                              <NewsTitle title={n.title} titleZh={n.titleZh} />
                            </h3>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            {/* 右栏：共同出现的实体 */}
            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-8">
                <div className="text-[11px] font-bold tracking-[0.3em] text-gray-500 uppercase">
                  CO-OCCURRENCE
                </div>

                <h2 className="mt-2 text-2xl font-bold">共同出现</h2>

                <p className="mt-3 text-sm leading-7 text-gray-600">
                  在相同事件中一同出现的其它实体，按共同事件数排序。
                </p>

                {coEntities.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
                    暂无共同出现的实体。
                  </p>
                ) : (
                  <ul className="mt-5 space-y-2">
                    {coEntities.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/entities/${c.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 transition hover:border-gray-900"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold">
                              {c.name}
                            </span>

                            <span className="text-xs text-gray-500">
                              {ENTITY_TYPE_LABELS[c.type] ?? c.type}
                            </span>
                          </span>

                          <span className="shrink-0 text-sm font-bold tabular-nums text-gray-600">
                            {c.shared}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
