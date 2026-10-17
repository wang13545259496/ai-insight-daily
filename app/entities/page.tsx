import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_ORDER,
} from "@/lib/entity/entityProfile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "实体库 - AI Insight Daily",
  description: "AI 产业中的公司、模型、产品与人物，及其关联的事件与动态。",
};

/** 每页数量 */
const PAGE_SIZE = 60;

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const sp = await searchParams;

  const type =
    sp.type && ENTITY_TYPE_ORDER.includes(sp.type) ? sp.type : null;

  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    status: { not: "merged" },
    ...(type ? { type } : {}),
  };

  const [total, entities, typeCounts] = await Promise.all([
    prisma.entity.count({ where }),

    prisma.entity.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        eventCount: true,
        newsCount: true,
      },
      /**
       * 排序刻意用 eventCount 而非 createdAt：
       * 关联事件多的实体才是读者想看的主角（Google 11 个事件、
       * OpenAI 5 个），而按时间排会先出现大量无关的零关联实体。
       */
      orderBy: [{ eventCount: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),

    prisma.entity.groupBy({
      by: ["type"],
      where: { status: { not: "merged" } },
      _count: true,
    }),
  ]);

  const typeTotal = new Map(typeCounts.map((t) => [t.type, t._count]));
  const allTotal = typeCounts.reduce((sum, t) => sum + t._count, 0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (p: number, t: string | null) => {
    const qs = new URLSearchParams();
    if (t) qs.set("type", t);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/entities?${s}` : "/entities";
  };

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-black lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* 头部 */}
        <header className="border-b border-gray-200 pb-8">
          <div className="text-[12px] sm:text-[11px] font-bold tracking-[0.3em] text-gray-500 uppercase">
            ENTITIES
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            实体库
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
            从新闻与事件中抽取的公司、模型、产品与人物。
            点击任一实体可查看它关联的事件，以及常与它一同出现的主体。
          </p>
        </header>

        {/* 类型筛选 */}
        <nav className="mt-8 flex flex-wrap gap-2">
          <Link
            href={buildHref(1, null)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              type === null
                ? "bg-black text-white"
                : "border border-gray-300 text-gray-700 hover:border-gray-900"
            }`}
          >
            全部 {allTotal}
          </Link>

          {ENTITY_TYPE_ORDER.map((t) => (
            <Link
              key={t}
              href={buildHref(1, t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                type === t
                  ? "bg-black text-white"
                  : "border border-gray-300 text-gray-700 hover:border-gray-900"
              }`}
            >
              {ENTITY_TYPE_LABELS[t]} {typeTotal.get(t) ?? 0}
            </Link>
          ))}
        </nav>

        {/* 列表 */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entities.map((e) => (
            <Link
              key={e.id}
              href={`/entities/${e.id}`}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-gray-900"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold group-hover:underline">
                  {e.name}
                </h2>

                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-[12px] sm:text-[11px] font-medium text-gray-600">
                  {ENTITY_TYPE_LABELS[e.type] ?? e.type}
                </span>
              </div>

              <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-gray-600">
                {e.description || "暂无说明"}
              </p>

              <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                {e.eventCount > 0 ? (
                  <span className="font-medium text-gray-900">
                    {e.eventCount} 个事件
                  </span>
                ) : (
                  <span>暂无关联事件</span>
                )}

                {e.newsCount > 0 && <span>{e.newsCount} 篇新闻</span>}
              </div>
            </Link>
          ))}
        </div>

        {entities.length === 0 && (
          <p className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
            没有符合条件的实体。
          </p>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-between border-t border-gray-200 pt-6 text-sm">
            {page > 1 ? (
              <Link
                href={buildHref(page - 1, type)}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium transition hover:border-gray-900"
              >
                ← 上一页
              </Link>
            ) : (
              <span />
            )}

            <span className="text-gray-500">
              第 {page} / {totalPages} 页
            </span>

            {page < totalPages ? (
              <Link
                href={buildHref(page + 1, type)}
                className="rounded-lg border border-gray-300 px-4 py-2 font-medium transition hover:border-gray-900"
              >
                下一页 →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  );
}
