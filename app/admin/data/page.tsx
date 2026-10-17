import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDataPage() {
const [
totalNews,
sourceNews,
noSourceNews,
duplicateNews,
emptySummaryNews,
verifiedNews,
activeNews,
inactiveNews,
sources,
latestProblems,
] = await Promise.all([
prisma.news.count(),

prisma.news.count({
  where: {
    sourceUrl: {
      not: "",
    },
  },
}),

prisma.news.count({
  where: {
    sourceUrl: "",
  },
}),

prisma.news.count({
  where: {
    duplicateHash: {
      not: null,
    },
  },
}),

prisma.news.count({
  where: {
    summary: "",
  },
}),

prisma.news.count({
  where: {
    verified: true,
  },
}),

prisma.news.count({
  where: {
    dataStatus: "active",
  },
}),

prisma.news.count({
  where: {
    dataStatus: {
      not: "active",
    },
  },
}),

prisma.news.groupBy({
  by: ["source"],
  _count: {
    source: true,
  },
  orderBy: {
    _count: {
      source: "desc",
    },
  },
  take: 10,
}),

prisma.news.findMany({
  where: {
    OR: [
      {
        sourceUrl: "",
      },
      {
        summary: "",
      },
    ],
  },
  orderBy: {
    createdAt: "desc",
  },
  take: 12,
  select: {
    id: true,
    title: true,
    source: true,
    createdAt: true,
    sourceUrl: true,
    summary: true,
    dataStatus: true,
  },
}),

]);

const sourceRate =
totalNews > 0
? Math.round((sourceNews / totalNews) * 100)
: 0;

const summaryRate =
totalNews > 0
? Math.round(
((totalNews - emptySummaryNews) / totalNews) * 100
)
: 0;

const duplicateRate =
totalNews > 0
? Math.round((duplicateNews / totalNews) * 100)
: 0;

const verifiedRate =
totalNews > 0
? Math.round((verifiedNews / totalNews) * 100)
: 0;

const sourceScore =
sourceRate >= 95
? 100
: sourceRate >= 90
? 90
: sourceRate >= 80
? 75
: sourceRate >= 60
? 60
: 40;

const summaryScore =
summaryRate >= 95
? 100
: summaryRate >= 90
? 90
: summaryRate >= 80
? 75
: summaryRate >= 60
? 60
: 40;

const duplicateScore =
duplicateRate <= 2
? 100
: duplicateRate <= 5
? 90
: duplicateRate <= 10
? 75
: duplicateRate <= 20
? 60
: 40;

const healthScore = Math.round(
(sourceScore + summaryScore + duplicateScore) / 3
);

const healthStatus =
healthScore >= 90
? "优秀"
: healthScore >= 75
? "良好"
: healthScore >= 60
? "需要治理"
: "数据质量异常";

const healthDescription =
healthScore >= 90
? "当前数据质量稳定，可以持续用于资讯分析、事件识别与商业分析。"
: healthScore >= 75
? "整体数据质量良好，但仍存在少量需要持续治理的数据问题。"
: healthScore >= 60
? "当前数据存在明显质量缺口，建议优先处理来源、摘要和重复数据。"
: "当前数据质量存在较大风险，需要立即进入数据治理流程。";

const problemCount = noSourceNews + emptySummaryNews;

return ( <main className="min-h-screen bg-black px-6 py-10 text-white md:px-10"> <div className="mx-auto max-w-7xl"> <div className="mb-10 flex flex-col justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end"> <div> <div className="mb-3 text-xs font-medium uppercase tracking-[0.35em] text-white/40">
AI INSIGHT DAILY · ADMIN </div>

        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          数据治理中心
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
          监控新闻数据质量、来源完整性、摘要完整性、重复数据与验证状态，
          为资讯分析与 AI 产业数据库提供稳定的数据基础。
        </p>
      </div>

      <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/60">
        数据健康：
        <span className="ml-2 font-semibold text-white">
          {healthScore}/100
        </span>
      </div>
    </div>

    <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-xs text-white/40">新闻总量</div>
        <div className="mt-3 text-3xl font-semibold">
          {totalNews.toLocaleString()}
        </div>
        <div className="mt-2 text-xs text-white/35">
          AI 资讯数据库
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-xs text-white/40">来源完整率</div>
        <div className="mt-3 text-3xl font-semibold">
          {sourceRate}%
        </div>
        <div className="mt-2 text-xs text-white/35">
          {sourceNews.toLocaleString()} 条有来源
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-xs text-white/40">摘要完整率</div>
        <div className="mt-3 text-3xl font-semibold">
          {summaryRate}%
        </div>
        <div className="mt-2 text-xs text-white/35">
          {emptySummaryNews.toLocaleString()} 条摘要异常
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-xs text-white/40">重复数据比例</div>
        <div className="mt-3 text-3xl font-semibold">
          {duplicateRate}%
        </div>
        <div className="mt-2 text-xs text-white/35">
          {duplicateNews.toLocaleString()} 条存在重复标识
        </div>
      </div>
    </section>

    <section className="mb-8 grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">数据健康评分</h2>

          <span
            className={`rounded-full px-3 py-1 text-xs ${
              healthScore >= 90
                ? "bg-white text-black"
                : healthScore >= 75
                  ? "bg-white/10 text-white"
                  : "bg-white/5 text-white/60"
            }`}
          >
            {healthStatus}
          </span>
        </div>

        <div className="mt-6 flex items-end gap-2">
          <span className="text-5xl font-semibold">
            {healthScore}
          </span>

          <span className="mb-2 text-sm text-white/30">
            / 100
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-white/45">
          {healthDescription}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="font-medium">数据验证</h2>

        <div className="mt-6 flex items-end gap-2">
          <span className="text-4xl font-semibold">
            {verifiedNews.toLocaleString()}
          </span>

          <span className="mb-1 text-sm text-white/30">
            / {totalNews.toLocaleString()}
          </span>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white"
            style={{
              width: `${verifiedRate}%`,
            }}
          />
        </div>

        <div className="mt-3 text-xs text-white/40">
          已验证比例 {verifiedRate}%
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="font-medium">治理问题</h2>

        <div className="mt-6 flex items-end gap-2">
          <span className="text-4xl font-semibold">
            {problemCount.toLocaleString()}
          </span>

          <span className="mb-1 text-sm text-white/30">
            条待处理
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-xs text-white/35">
              缺少来源
            </div>
            <div className="mt-1 text-lg font-medium">
              {noSourceNews.toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-xs text-white/35">
              缺少摘要
            </div>
            <div className="mt-1 text-lg font-medium">
              {emptySummaryNews.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">
            数据状态
          </h2>

          <p className="mt-1 text-xs text-white/35">
            当前数据库中不同数据状态的规模
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-5">
          <div className="text-xs text-white/35">
            Active
          </div>

          <div className="mt-2 text-2xl font-semibold">
            {activeNews.toLocaleString()}
          </div>

          <div className="mt-1 text-xs text-white/30">
            正常数据
          </div>
        </div>

        <div className="rounded-xl border border-white/10 p-5">
          <div className="text-xs text-white/35">
            非 Active
          </div>

          <div className="mt-2 text-2xl font-semibold">
            {inactiveNews.toLocaleString()}
          </div>

          <div className="mt-1 text-xs text-white/30">
            待检查或历史状态
          </div>
        </div>

        <div className="rounded-xl border border-white/10 p-5">
          <div className="text-xs text-white/35">
            已验证
          </div>

          <div className="mt-2 text-2xl font-semibold">
            {verifiedNews.toLocaleString()}
          </div>

          <div className="mt-1 text-xs text-white/30">
            通过来源验证
          </div>
        </div>
      </div>
    </section>

    <section className="mb-8 grid gap-8 xl:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium">
            来源分布 Top 10
          </h2>

          <p className="mt-1 text-xs text-white/35">
            新闻数据来源结构
          </p>
        </div>

        {sources.length === 0 ? (
          <div className="py-10 text-center text-sm text-white/30">
            暂无来源数据
          </div>
        ) : (
          <div className="space-y-4">
            {sources.map((item, index) => {
              const count = item._count.source;

              const percentage =
                totalNews > 0
                  ? Math.round((count / totalNews) * 100)
                  : 0;

              return (
                <div key={item.source || `source-${index}`}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="truncate text-white/70">
                      {item.source || "未知来源"}
                    </span>

                    <span className="ml-4 text-white/40">
                      {count.toLocaleString()}
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white/70"
                      style={{
                        width: `${Math.max(percentage, 1)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium">
            治理指标
          </h2>

          <p className="mt-1 text-xs text-white/35">
            当前数据质量关键指标
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-white/60">
                来源完整率
              </span>

              <span>{sourceRate}%</span>
            </div>

            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${sourceRate}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-white/60">
                摘要完整率
              </span>

              <span>{summaryRate}%</span>
            </div>

            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${summaryRate}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-white/60">
                验证覆盖率
              </span>

              <span>{verifiedRate}%</span>
            </div>

            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${verifiedRate}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-white/60">
                重复数据比例
              </span>

              <span>{duplicateRate}%</span>
            </div>

            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/50"
                style={{
                  width: `${Math.min(duplicateRate * 5, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-lg font-medium">
            最新治理问题
          </h2>

          <p className="mt-1 text-xs text-white/35">
            优先检查缺少来源或摘要的新闻数据
          </p>
        </div>

        <div className="text-xs text-white/30">
          {latestProblems.length} 条
        </div>
      </div>

      {latestProblems.length === 0 ? (
        <div className="rounded-xl border border-white/10 py-12 text-center">
          <div className="text-lg">数据质量良好</div>
          <div className="mt-2 text-sm text-white/35">
            当前没有发现需要优先治理的新闻记录。
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/35">
                <th className="pb-4 pr-4 font-normal">
                  新闻
                </th>

                <th className="pb-4 pr-4 font-normal">
                  来源
                </th>

                <th className="pb-4 pr-4 font-normal">
                  问题
                </th>

                <th className="pb-4 pr-4 font-normal">
                  状态
                </th>

                <th className="pb-4 text-right font-normal">
                  操作
                </th>
              </tr>
            </thead>

            <tbody>
              {latestProblems.map((item) => {
                const problems: string[] = [];

                if (!item.sourceUrl) {
                  problems.push("缺少来源");
                }

                if (!item.summary) {
                  problems.push("缺少摘要");
                }

                return (
                  <tr
                    key={item.id}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="max-w-[360px] py-4 pr-4">
                      <div className="truncate text-sm text-white/80">
                        {item.title}
                      </div>

                      <div className="mt-1 text-xs text-white/25">
                        {new Date(
                          item.createdAt
                        ).toLocaleString("zh-CN")}
                      </div>
                    </td>

                    <td className="py-4 pr-4 text-sm text-white/50">
                      {item.source || "未知来源"}
                    </td>

                    <td className="py-4 pr-4">
                      <div className="flex flex-wrap gap-2">
                        {problems.map((problem) => (
                          <span
                            key={problem}
                            className="rounded-full border border-white/10 px-2.5 py-1 text-[12px] sm:text-[11px] text-white/50"
                          >
                            {problem}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 pr-4 text-xs text-white/40">
                      {item.dataStatus || "unknown"}
                    </td>

                    <td className="py-4 text-right">
                      <Link
                        href={`/news/${item.id}`}
                        className="text-xs text-white/60 transition hover:text-white"
                      >
                        查看新闻 →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>

    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href="/admin/system"
        className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
      >
        系统监控
      </Link>

      <Link
        href="/news"
        className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
      >
        新闻数据库
      </Link>

      <Link
        href="/"
        className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
      >
        返回首页
      </Link>
    </div>
  </div>
</main>

);

}
