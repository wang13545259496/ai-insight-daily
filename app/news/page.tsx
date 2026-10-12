import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(date: Date) {
  return new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hoursSince(date: Date) {
  return (Date.now() - new Date(date).getTime()) / 3600000;
}

/**
 * 清理资讯摘要中的重复片段。
 *
 * 部分历史 RSS / AI 摘要存在：
 * - 同一句话重复
 * - 连续片段重复
 * - 截断位置发生拼接
 *
 * 这里仅做展示层清洗，不修改数据库原始内容。
 */
function cleanSummary(value: string | null | undefined) {
  if (!value) {
    return "暂无摘要";
  }

  let text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return "暂无摘要";
  }

  // 第一层：删除完全重复的句子。
  const sentenceParts = text.match(
    /[^。！？!?；;]+[。！？!?；;]?/g
  );

  if (sentenceParts && sentenceParts.length > 1) {
    const seen = new Set<string>();
    const cleanedSentences: string[] = [];

    for (const sentence of sentenceParts) {
      const normalized = sentence
        .replace(/\s+/g, "")
        .trim();

      if (!normalized) {
        continue;
      }

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      cleanedSentences.push(sentence.trim());
    }

    if (cleanedSentences.length > 0) {
      text = cleanedSentences.join("");
    }
  }

  /*
   * 第二层：处理 RSS / AI 输出中的连续重复片段。
   *
   * 只处理较长且明显重复的片段，避免误删正常的短语。
   */
  const minRepeatLength = 18;
  const maxRepeatLength = Math.min(80, Math.floor(text.length / 3));

  for (
    let length = maxRepeatLength;
    length >= minRepeatLength;
    length--
  ) {
    let fixed = false;

    for (let start = 0; start + length <= text.length; start++) {
      const fragment = text.slice(start, start + length).trim();

      if (fragment.length < minRepeatLength) {
        continue;
      }

      const secondIndex = text.indexOf(
        fragment,
        start + length
      );

      if (secondIndex === -1) {
        continue;
      }

      /*
       * 两次重复之间距离不能太远。
       * 这样可以避免把正常文章中再次出现的公司名、产品名误判为重复。
       */
      const distance = secondIndex - (start + length);

      if (distance > 260) {
        continue;
      }

      const before = text.slice(
        Math.max(0, start - 4),
        start
      );

      const after = text.slice(
        secondIndex + length,
        secondIndex + length + 4
      );

      /*
       * 优先处理句子/短语级重复。
       */
      const looksLikeFragment =
        /[。！？!?；;，,：:、\s]/.test(before) ||
        /[。！？!?；;，,：:、\s]/.test(after);

      if (!looksLikeFragment) {
        continue;
      }

      text =
        text.slice(0, secondIndex) +
        text.slice(secondIndex + length);

      fixed = true;
      break;
    }

    if (fixed) {
      break;
    }
  }

  return text;
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="border border-gray-200 bg-white p-6">
      <div className="text-xs font-bold tracking-[0.2em] text-gray-400">
        {label}
      </div>

      <div className="mt-3 text-4xl font-black tracking-tight text-black">
        {value}
      </div>

      <div className="mt-2 text-sm text-gray-500">
        {detail}
      </div>
    </div>
  );
}

function Badge({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        dark
          ? "bg-white/10 text-white"
          : "border border-gray-200 bg-gray-50 text-gray-600"
      }`}
    >
      {children}
    </span>
  );
}

export default async function NewsPage() {
  const now = Date.now();
  const time24h = new Date(now - 24 * 60 * 60 * 1000);
  const time72h = new Date(now - 72 * 60 * 60 * 1000);

  const news = await prisma.news.findMany({
    where: {
      dataStatus: "active",
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 60,
    include: {
      event: {
        select: {
          id: true,
          title: true,
          category: true,
          heatScore: true,
          trendStatus: true,
        },
      },
      sourceRef: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const [recent24h, recent72h, verifiedCount] = await Promise.all([
    prisma.news.count({
      where: {
        dataStatus: "active",
        publishedAt: {
          gte: time24h,
        },
      },
    }),
    prisma.news.count({
      where: {
        dataStatus: "active",
        publishedAt: {
          gte: time72h,
        },
      },
    }),
    prisma.news.count({
      where: {
        dataStatus: "active",
        verified: true,
      },
    }),
  ]);

  const categories = Array.from(
    new Set(
      news
        .map((item) => item.category)
        .filter(Boolean)
    )
  ).sort();

  const sources = Array.from(
    new Set(
      news
        .map(
          (item) =>
            item.sourceRef?.name || item.source
        )
        .filter(Boolean)
    )
  ).sort();

  /*
   * 高价值信号只展示已经完成 AI 分析的资讯。
   * 待分析新闻的 aiScore 默认为 0，不应该进入这里。
   */
  const highScoreNews = [...news]
    .filter(
      (item) =>
        item.analysisStatus === "completed" &&
        item.aiScore > 0
    )
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 5);

  const displayNews = [...news]
    .sort((a, b) => {
      const aHours = hoursSince((a.publishedAt ?? a.createdAt));
      const bHours = hoursSince((b.publishedAt ?? b.createdAt));

      const aFresh =
        aHours <= 24 ? 3 : aHours <= 72 ? 2 : 1;

      const bFresh =
        bHours <= 24 ? 3 : bHours <= 72 ? 2 : 1;

      if (aFresh !== bFresh) {
        return bFresh - aFresh;
      }

      if (a.verified !== b.verified) {
        return a.verified ? -1 : 1;
      }

      /*
       * 已完成 AI 分析的资讯优先于待分析资讯。
       */
      const aAnalyzed =
        a.analysisStatus === "completed";

      const bAnalyzed =
        b.analysisStatus === "completed";

      if (aAnalyzed !== bAnalyzed) {
        return aAnalyzed ? -1 : 1;
      }

      if (b.aiScore !== a.aiScore) {
        return b.aiScore - a.aiScore;
      }

      return (
        new Date((b.publishedAt ?? b.createdAt)).getTime() -
        new Date((a.publishedAt ?? a.createdAt)).getTime()
      );
    });

  return (
    <main className="min-h-screen bg-white text-black">
      {/* HEADER */}



      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        {/* HERO */}

        <section className="border-b border-gray-200 pb-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <div className="mb-4 text-xs font-bold tracking-[0.3em] text-gray-400">
                AI NEWS INTELLIGENCE CENTER
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                AI资讯中心
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-500">
                从实时新闻到产业事件，持续追踪全球 AI
                技术、企业、产品与商业变化。
              </p>
            </div>

            <div className="border-l-2 border-black pl-5 text-sm text-gray-500">
              <div className="font-bold text-black">
                LIVE INTELLIGENCE STREAM
              </div>

              <div className="mt-2">
                当前展示最近 {news.length} 条有效资讯
              </div>
            </div>
          </div>
        </section>

        {/* OVERVIEW */}

        <section className="grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="ACTIVE NEWS"
            value={news.length}
            detail="当前有效资讯"
          />

          <StatCard
            label="24H UPDATES"
            value={recent24h}
            detail="最近24小时新增"
          />

          <StatCard
            label="72H DYNAMICS"
            value={recent72h}
            detail="最近72小时新增"
          />

          <StatCard
            label="VERIFIED"
            value={verifiedCount}
            detail={`已验证 / ${news.length || 0}`}
          />
        </section>

        {/* FILTER / TAXONOMY */}

        <section className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <div className="text-xs font-bold tracking-[0.25em] text-gray-400">
              CATEGORIES
            </div>

            <h2 className="mt-3 text-2xl font-black">
              AI产业分类
            </h2>

            <div className="mt-5 flex flex-wrap gap-2">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <span
                    key={category}
                    className="border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700"
                  >
                    {category}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">
                  暂无分类数据
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold tracking-[0.25em] text-gray-400">
              SOURCES
            </div>

            <h2 className="mt-3 text-2xl font-black">
              数据来源
            </h2>

            <div className="mt-5 flex flex-wrap gap-2">
              {sources.length > 0 ? (
                sources.map((source) => (
                  <span
                    key={source}
                    className="border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600"
                  >
                    {source}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">
                  暂无来源数据
                </span>
              )}
            </div>
          </div>
        </section>

        {/* HIGH VALUE INTELLIGENCE */}

        {highScoreNews.length > 0 && (
          <section className="mt-16">
            <div className="flex items-end justify-between border-b border-gray-200 pb-5">
              <div>
                <div className="text-xs font-bold tracking-[0.25em] text-gray-400">
                  INTELLIGENCE SIGNAL
                </div>

                <h2 className="mt-2 text-3xl font-black">
                  高价值资讯信号
                </h2>
              </div>

              <div className="hidden text-sm text-gray-400 md:block">
                AI Score / VERIFIED / EVENT
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
              {highScoreNews.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/news/${item.id}`}
                  className="group border border-gray-200 bg-black p-5 text-white transition hover:-translate-y-1 hover:bg-gray-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-[0.2em] text-gray-500">
                      SIGNAL 0{index + 1}
                    </span>

                    <span className="text-sm font-black">
                      {Math.round(item.aiScore)}
                    </span>
                  </div>

                  <h3 className="mt-5 line-clamp-3 text-base font-bold leading-6">
                    {item.title}
                  </h3>

                  <div className="mt-5 text-xs text-gray-400">
                    {item.category}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    {formatDate(item.publishedAt ?? item.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* NEWS STREAM */}

        <section className="mt-16">
          <div className="flex flex-col justify-between gap-4 border-b border-black pb-5 md:flex-row md:items-end">
            <div>
              <div className="text-xs font-bold tracking-[0.25em] text-gray-400">
                NEWS STREAM
              </div>

              <h2 className="mt-2 text-3xl font-black">
                最新AI动态
              </h2>
            </div>

            <div className="text-sm text-gray-500">
              按实时性 → 验证状态 → AI分析状态 → AI评分 → 时间排序
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {displayNews.map((item, index) => {
              const event = item.event;
              const hours = hoursSince(item.publishedAt ?? item.createdAt);

              const freshness =
                hours <= 24
                  ? "24H"
                  : hours <= 72
                    ? "72H"
                    : "ARCHIVE";

              const isAnalyzed =
                item.analysisStatus === "completed";

              const summary = cleanSummary(
                item.summary
              );

              return (
                <article
                  key={item.id}
                  className="group border border-gray-200 bg-white transition hover:border-black"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[90px_1fr_220px]">
                    {/* INDEX */}

                    <div className="flex items-start border-b border-gray-100 bg-gray-50 p-5 lg:border-b-0 lg:border-r">
                      <div>
                        <div className="text-xs font-black tracking-[0.15em] text-gray-400">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <div className="mt-3 text-xs font-bold text-black">
                          {freshness}
                        </div>
                      </div>
                    </div>

                    {/* CONTENT */}

                    <div className="p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{item.category}</Badge>

                        {item.verified && (
                          <Badge>✓ 已验证</Badge>
                        )}

                        {isAnalyzed ? (
                          <Badge>AI分析完成</Badge>
                        ) : (
                          <Badge>AI分析待处理</Badge>
                        )}
                      </div>

                      <Link
                        href={`/news/${item.id}`}
                        className="mt-4 block"
                      >
                        <h3 className="text-xl font-black leading-8 transition group-hover:underline">
                          {item.title}
                        </h3>
                      </Link>

                      <p className="mt-3 line-clamp-2 max-w-4xl text-sm leading-7 text-gray-500">
                        {summary}
                      </p>

                      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-400">
                        <span>
                          {item.sourceRef?.name ||
                            item.source ||
                            "未知来源"}
                        </span>

                        <span>
                          {formatDate(item.publishedAt ?? item.createdAt)}
                        </span>

                        {isAnalyzed && item.aiScore > 0 ? (
                          <span>
                            AI Score{" "}
                            {Math.round(item.aiScore)}
                          </span>
                        ) : (
                          <span>
                            AI Score 暂未生成
                          </span>
                        )}
                      </div>
                    </div>

                    {/* RIGHT INTELLIGENCE */}

                    <div className="border-t border-gray-100 bg-gray-50 p-6 lg:border-l lg:border-t-0">
                      <div className="text-xs font-bold tracking-[0.2em] text-gray-400">
                        EVENT
                      </div>

                      {event ? (
                        <>
                          <Link
                            href={`/events/${event.id}`}
                            className="mt-3 block text-sm font-bold leading-6 text-black hover:underline"
                          >
                            {event.title}
                          </Link>

                          <div className="mt-4 flex items-center justify-between text-xs">
                            <span className="text-gray-400">
                              {event.trendStatus ||
                                "rising"}
                            </span>

                            <span className="font-bold text-black">
                              EVENT HEAT{" "}
                              {Math.round(
                                event.heatScore
                              )}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 text-sm text-gray-400">
                          暂未关联事件
                        </div>
                      )}

                      <div className="mt-6 border-t border-gray-200 pt-4">
                        <Link
                          href={`/news/${item.id}`}
                          className="text-xs font-bold tracking-[0.12em] text-black hover:underline"
                        >
                          查看资讯详情 →
                        </Link>

                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 block text-xs font-bold tracking-[0.12em] text-gray-500 hover:text-black"
                          >
                            原始来源 ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* DATA QUALITY */}

        <section className="mt-16 grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 md:grid-cols-3">
          <div className="bg-black p-7 text-white">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-500">
              DATA STATUS
            </div>

            <div className="mt-3 text-2xl font-black">
              ACTIVE
            </div>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              页面仅展示当前有效资讯数据。
            </p>
          </div>

          <div className="bg-white p-7">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-400">
              VERIFICATION
            </div>

            <div className="mt-3 text-2xl font-black">
              {verifiedCount}
            </div>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              已完成来源验证的资讯数量。
            </p>
          </div>

          <div className="bg-white p-7">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-400">
              TRACEABILITY
            </div>

            <div className="mt-3 text-2xl font-black">
              EVENT → NEWS
            </div>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              资讯可追溯至关联事件及原始来源。
            </p>
          </div>
        </section>

        {/* FOOTER */}

        <footer className="mt-16 border-t border-gray-200 py-8 text-xs text-gray-400">
          AI Insight Daily · News Intelligence Center
        </footer>
      </div>
    </main>
  );
}
