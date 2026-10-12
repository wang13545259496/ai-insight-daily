import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

type SearchParams = {
  q?: string;
  category?: string;
  status?: string;
  verified?: string;
  page?: string;
};

async function verifyNews(formData: FormData) {
  "use server";

  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.news.update({
    where: {
      id,
    },
    data: {
      verified: true,
    },
  });

  revalidatePath("/admin/news");
}

async function deleteNews(formData: FormData) {
  "use server";

  const id = Number(formData.get("id"));

  if (!id) {
    return;
  }

  await prisma.news.delete({
    where: {
      id,
    },
  });

  revalidatePath("/admin/news");
}

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const q = params.q?.trim() || "";
  const category = params.category?.trim() || "";
  const status = params.status?.trim() || "";
  const verified = params.verified?.trim() || "";

  const requestedPage = Number(params.page || "1");

  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;

  const where: any = {};

  if (q) {
    where.OR = [
      {
        title: {
          contains: q,
        },
      },
      {
        source: {
          contains: q,
        },
      },
    ];
  }

  if (category) {
    where.category = category;
  }

  if (status) {
    where.dataStatus = status;
  }

  if (verified === "verified") {
    where.verified = true;
  }

  if (verified === "unverified") {
    where.verified = false;
  }

  const [
    totalNews,
    filteredNews,
    categories,
    activeCount,
    verifiedCount,
  ] = await Promise.all([
    prisma.news.count(),

    prisma.news.count({
      where,
    }),

    prisma.news.groupBy({
      by: ["category"],
      _count: {
        category: true,
      },
      orderBy: {
        _count: {
          category: "desc",
        },
      },
      take: 30,
    }),

    prisma.news.count({
      where: {
        dataStatus: "active",
      },
    }),

    prisma.news.count({
      where: {
        verified: true,
      },
    }),
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredNews / PAGE_SIZE)
  );

  const safePage = Math.min(
    currentPage,
    totalPages
  );

  const news = await prisma.news.findMany({
    where,

    orderBy: {
      createdAt: "desc",
    },

    skip: (safePage - 1) * PAGE_SIZE,

    take: PAGE_SIZE,

    select: {
      id: true,
      title: true,
      category: true,
      source: true,
      summary: true,
      verified: true,
      dataStatus: true,
      sourceUrl: true,
      createdAt: true,
    },
  });

  const createPageUrl = (page: number) => {
    const search = new URLSearchParams();

    if (q) {
      search.set("q", q);
    }

    if (category) {
      search.set("category", category);
    }

    if (status) {
      search.set("status", status);
    }

    if (verified) {
      search.set("verified", verified);
    }

    search.set("page", String(page));

    return `/admin/news?${search.toString()}`;
  };

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-white/10 pb-8">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.35em] text-white/40">
            AI INSIGHT DAILY · ADMIN
          </div>

          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                资讯数据库管理中心
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
                管理 AI 资讯数据库中的新闻记录，检查来源、摘要、验证状态和数据状态。
              </p>
            </div>

            <Link
              href="/admin/data"
              className="inline-flex w-fit rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
            >
              数据治理中心 →
            </Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs text-white/35">新闻总量</div>
            <div className="mt-3 text-3xl font-semibold">
              {totalNews.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-white/25">
              数据库全部新闻
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs text-white/35">当前结果</div>
            <div className="mt-3 text-3xl font-semibold">
              {filteredNews.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-white/25">
              当前筛选条件
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs text-white/35">已验证</div>
            <div className="mt-3 text-3xl font-semibold">
              {verifiedCount.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-white/25">
              已完成来源验证
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs text-white/35">Active</div>
            <div className="mt-3 text-3xl font-semibold">
              {activeCount.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-white/25">
              当前有效数据
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-5">
            <h2 className="text-lg font-medium">数据筛选</h2>
            <p className="mt-1 text-xs text-white/35">
              搜索标题或来源，并按分类、状态和验证情况筛选。
            </p>
          </div>

          <form
            method="GET"
            className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]"
          >
            <input
              name="q"
              defaultValue={q}
              placeholder="搜索新闻标题或来源..."
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
            />

            <select
              name="category"
              defaultValue={category}
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white/70 outline-none focus:border-white/30"
            >
              <option value="">全部分类</option>

              {categories.map((item) => (
                <option
                  key={item.category || "unknown"}
                  value={item.category || ""}
                >
                  {item.category || "未分类"}（
                  {item._count.category}）
                </option>
              ))}
            </select>

            <select
              name="status"
              defaultValue={status}
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white/70 outline-none focus:border-white/30"
            >
              <option value="">全部状态</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              name="verified"
              defaultValue={verified}
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white/70 outline-none focus:border-white/30"
            >
              <option value="">全部验证状态</option>
              <option value="verified">已验证</option>
              <option value="unverified">未验证</option>
            </select>

            <button
              type="submit"
              className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90"
            >
              搜索
            </button>
          </form>

          {(q || category || status || verified) && (
            <div className="mt-4">
              <Link
                href="/admin/news"
                className="text-xs text-white/40 transition hover:text-white"
              >
                清除全部筛选 →
              </Link>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-6 py-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-medium">新闻记录</h2>
              <p className="mt-1 text-xs text-white/30">
                第 {safePage} / {totalPages} 页 · 每页 {PAGE_SIZE} 条
              </p>
            </div>

            <div className="text-xs text-white/30">
              共 {filteredNews.toLocaleString()} 条结果
            </div>
          </div>

          {news.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="text-lg text-white/70">
                没有找到新闻
              </div>

              <div className="mt-2 text-sm text-white/30">
                请调整搜索关键词或筛选条件。
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {news.map((item) => (
                <article
                  key={item.id}
                  className="px-6 py-6 transition hover:bg-white/[0.02]"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/45">
                          {item.category || "未分类"}
                        </span>

                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/45">
                          {item.source || "未知来源"}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] ${
                            item.verified
                              ? "border-white/20 text-white/75"
                              : "border-white/10 text-white/35"
                          }`}
                        >
                          {item.verified ? "已验证" : "未验证"}
                        </span>

                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/35">
                          {item.dataStatus || "unknown"}
                        </span>
                      </div>

                      <h3 className="max-w-4xl text-lg font-medium leading-7 text-white/90">
                        {item.title}
                      </h3>

                      <p className="mt-3 max-w-4xl text-sm leading-6 text-white/40">
                        {item.summary
                          ? item.summary
                          : "暂无摘要，需要进入数据治理流程。"}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/25">
                        <span>ID：{item.id}</span>

                        <span>
                          {new Date(item.createdAt).toLocaleString("zh-CN")}
                        </span>

                        <span>
                          {item.sourceUrl
                            ? "已有原始来源"
                            : "缺少原始来源"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 xl:w-[280px] xl:justify-end">
                      <Link
                        href={`/news/${item.id}`}
                        className="rounded-xl border border-white/10 px-3.5 py-2 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                      >
                        查看详情
                      </Link>

                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 px-3.5 py-2 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                        >
                          原始来源
                        </a>
                      )}

                      {!item.verified && (
                        <form action={verifyNews}>
                          <input
                            type="hidden"
                            name="id"
                            value={item.id}
                          />

                          <button
                            type="submit"
                            className="rounded-xl border border-white/10 px-3.5 py-2 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                          >
                            标记验证
                          </button>
                        </form>
                      )}

                      <form action={deleteNews}>
                        <input
                          type="hidden"
                          name="id"
                          value={item.id}
                        />

                        <button
                          type="submit"
                          className="rounded-xl border border-white/10 px-3.5 py-2 text-xs text-white/40 transition hover:border-white/30 hover:text-white"
                        >
                          删除
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col justify-between gap-4 border-t border-white/10 px-6 py-5 sm:flex-row sm:items-center">
              <div className="text-xs text-white/30">
                第 {safePage} 页，共 {totalPages} 页
              </div>

              <div className="flex gap-2">
                {safePage > 1 ? (
                  <Link
                    href={createPageUrl(safePage - 1)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                  >
                    ← 上一页
                  </Link>
                ) : (
                  <span className="rounded-xl border border-white/5 px-4 py-2 text-xs text-white/20">
                    ← 上一页
                  </span>
                )}

                {safePage < totalPages ? (
                  <Link
                    href={createPageUrl(safePage + 1)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
                  >
                    下一页 →
                  </Link>
                ) : (
                  <span className="rounded-xl border border-white/5 px-4 py-2 text-xs text-white/20">
                    下一页 →
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        <footer className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/admin/data"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 transition hover:border-white/20 hover:text-white"
          >
            数据治理中心
          </Link>

          <Link
            href="/admin/system"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 transition hover:border-white/20 hover:text-white"
          >
            系统监控
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 transition hover:border-white/20 hover:text-white"
          >
            返回首页
          </Link>
        </footer>
      </div>
    </main>
  );
}
