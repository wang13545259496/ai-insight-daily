import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TrendItem = {
  name: string;
  count7: number;
  count30: number;
  recent24: number;
  avgScore: number;
  heat: number;
  growth: number;
  status: "rising" | "stable" | "falling";
};

const CATEGORY_RULES: Record<string, string[]> = {
  "AI智能体": ["agent", "智能体", "代理", "autonomous", "workflow", "copilot"],
  "AI大模型": ["大模型", "模型", "llm", "gpt", "claude", "gemini", "deepseek"],
  "AI编程": ["编程", "代码", "coding", "developer", "开发工具", "代码助手"],
  "AI机器人": ["机器人", "robot", "humanoid", "人形", "具身智能"],
  "多模态AI": ["多模态", "multimodal", "视觉", "语音", "image", "video"],
  "AI芯片": ["芯片", "gpu", "npu", "算力", "半导体", "accelerator"],
  "AI应用": ["应用", "app", "搜索", "办公", "营销", "客服"],
  "AI安全": ["安全", "security", "网络攻击", "防御", "隐私"],
};

function normalize(value: string | null | undefined) {
  return (value || "").toLowerCase();
}

function matchesCategory(
  item: {
    title: string;
    category: string;
    summary: string;
    content: string;
  },
  keywords: string[]
) {
  const text = normalize(
    `${item.title} ${item.category} ${item.summary} ${item.content}`
  );

  return keywords.some((keyword) =>
    text.includes(keyword.toLowerCase())
  );
}

function getStatus(growth: number): TrendItem["status"] {
  if (growth >= 15) return "rising";
  if (growth <= -15) return "falling";
  return "stable";
}

function statusLabel(status: TrendItem["status"]) {
  if (status === "rising") return "上升";
  if (status === "falling") return "回落";
  return "稳定";
}

function statusDescription(status: TrendItem["status"]) {
  if (status === "rising") {
    return "近期资讯活跃度明显提升，值得持续跟踪。";
  }

  if (status === "falling") {
    return "近期讨论热度有所下降，进入观察阶段。";
  }

  return "近期保持相对稳定，暂未出现明显加速信号。";
}

function formatScore(value: number) {
  return Math.round(value);
}

export default async function TrendPage() {
  const now = Date.now();

  const sevenDaysAgo = new Date(
    now - 7 * 24 * 60 * 60 * 1000
  );

  const fourteenDaysAgo = new Date(
    now - 14 * 24 * 60 * 60 * 1000
  );

  const thirtyDaysAgo = new Date(
    now - 30 * 24 * 60 * 60 * 1000
  );

  const twentyFourHoursAgo = new Date(
    now - 24 * 60 * 60 * 1000
  );

  const news = await prisma.news.findMany({
    where: {
      dataStatus: "active",
      publishedAt: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      id: true,
      title: true,
      category: true,
      summary: true,
      content: true,
      aiScore: true,
      createdAt: true,
      publishedAt: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 3000,
  });

  const trends: TrendItem[] = Object.entries(CATEGORY_RULES)
    .map(([name, keywords]) => {
      const matched = news.filter((item) =>
        matchesCategory(item, keywords)
      );

      const recent7 = matched.filter(
        (item) => new Date(item.publishedAt ?? item.createdAt) >= sevenDaysAgo
      );

      const previous7 = matched.filter((item) => {
        const date = new Date(item.publishedAt ?? item.createdAt);

        return (
          date >= fourteenDaysAgo &&
          date < sevenDaysAgo
        );
      });

      const recent24 = matched.filter(
        (item) => new Date(item.publishedAt ?? item.createdAt) >= twentyFourHoursAgo
      );

      const avgScore =
        recent7.length > 0
          ? recent7.reduce(
              (sum, item) => sum + Number(item.aiScore || 0),
              0
            ) / recent7.length
          : 0;

      const rawGrowth =
        previous7.length === 0
          ? recent7.length > 0
            ? 100
            : 0
          : ((recent7.length - previous7.length) /
              previous7.length) *
            100;

      const growth = Math.max(
        -100,
        Math.min(100, Math.round(rawGrowth))
      );

      const heat = Math.min(
        100,
        Math.round(
          Math.min(
            70,
            recent7.length * 3
          ) +
            Math.min(
              20,
              recent24.length * 5
            ) +
            Math.min(
              10,
              avgScore / 10
            )
        )
      );

      return {
        name,
        count7: recent7.length,
        count30: matched.length,
        recent24: recent24.length,
        avgScore,
        heat,
        growth,
        status: getStatus(growth),
      };
    })
    .filter((item) => item.count30 > 0)
    .sort((a, b) => {
      if (b.heat !== a.heat) {
        return b.heat - a.heat;
      }

      return b.count7 - a.count7;
    });

  const risingCount = trends.filter(
    (item) => item.status === "rising"
  ).length;

  const recent24Total = news.filter(
    (item) => new Date(item.publishedAt ?? item.createdAt) >= twentyFourHoursAgo
  ).length;

  const recent7Total = news.filter(
    (item) => new Date(item.publishedAt ?? item.createdAt) >= sevenDaysAgo
  ).length;

  const averageAiScore =
    news.length > 0
      ? news.reduce(
          (sum, item) => sum + Number(item.aiScore || 0),
          0
        ) / news.length
      : 0;

  const topTrend = trends[0];

  return (
    <main className="min-h-screen bg-white text-black">
      {/* HEADER */}



      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        {/* HERO */}

        <section className="border-b border-gray-200 pb-10">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-bold tracking-[0.3em] text-gray-400">
                AI INDUSTRY TREND INTELLIGENCE
              </div>

              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                AI产业趋势分析中心
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-500">
                基于近30天真实资讯数据，观察不同AI产业方向的活跃度、
                变化速度与近期信号。
              </p>
            </div>

            <Link
              href="/trend/predict"
              className="inline-flex items-center justify-center border border-black bg-black px-6 py-4 text-sm font-bold text-white transition hover:bg-gray-800"
            >
              进入AI预测引擎 →
            </Link>
          </div>
        </section>

        {/* OVERVIEW */}

        <section className="mt-10 grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white p-6">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-400">
              TRACKED NEWS
            </div>

            <div className="mt-3 text-4xl font-black">
              {news.length}
            </div>

            <div className="mt-2 text-sm text-gray-500">
              近30天有效资讯
            </div>
          </div>

          <div className="bg-white p-6">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-400">
              7D ACTIVITY
            </div>

            <div className="mt-3 text-4xl font-black">
              {recent7Total}
            </div>

            <div className="mt-2 text-sm text-gray-500">
              近7天产业动态
            </div>
          </div>

          <div className="bg-white p-6">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-400">
              24H SIGNAL
            </div>

            <div className="mt-3 text-4xl font-black">
              {recent24Total}
            </div>

            <div className="mt-2 text-sm text-gray-500">
              最近24小时新增
            </div>
          </div>

          <div className="bg-black p-6 text-white">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-500">
              RISING DIRECTIONS
            </div>

            <div className="mt-3 text-4xl font-black">
              {risingCount}
            </div>

            <div className="mt-2 text-sm text-gray-400">
              当前上升方向
            </div>
          </div>
        </section>

        {/* CURRENT SIGNAL */}

        {topTrend && (
          <section className="mt-14 border border-black bg-black p-7 text-white md:p-9">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <div className="text-xs font-bold tracking-[0.25em] text-gray-500">
                  CURRENT LEADING SIGNAL
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-black md:text-4xl">
                    {topTrend.name}
                  </h2>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
                    {statusLabel(topTrend.status)}
                  </span>
                </div>

                <p className="mt-4 leading-7 text-gray-400">
                  {statusDescription(topTrend.status)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-8">
                <div>
                  <div className="text-xs text-gray-500">
                    HEAT
                  </div>

                  <div className="mt-2 text-3xl font-black">
                    {topTrend.heat}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    7D NEWS
                  </div>

                  <div className="mt-2 text-3xl font-black">
                    {topTrend.count7}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    GROWTH
                  </div>

                  <div className="mt-2 text-3xl font-black">
                    {topTrend.growth > 0 ? "+" : ""}
                    {topTrend.growth}%
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TREND RANKING */}

        <section className="mt-16">
          <div className="flex flex-col justify-between gap-4 border-b border-black pb-5 md:flex-row md:items-end">
            <div>
              <div className="text-xs font-bold tracking-[0.25em] text-gray-400">
                TREND RANKING
              </div>

              <h2 className="mt-2 text-3xl font-black">
                AI产业方向排行榜
              </h2>
            </div>

            <div className="text-sm text-gray-500">
              热度 = 近期活跃度 + 24H信号 + AI评分
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {trends.map((item, index) => (
              <div
                key={item.name}
                className="border border-gray-200 bg-white transition hover:border-black"
              >
                <div className="grid grid-cols-1 lg:grid-cols-[80px_1fr_170px_170px_170px]">
                  <div className="flex items-start bg-gray-50 p-5 lg:border-r lg:border-gray-100">
                    <div>
                      <div className="text-xs font-black tracking-[0.15em] text-gray-400">
                        #{String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="mt-3 text-xs font-bold">
                        {statusLabel(item.status)}
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-black">
                      {item.name}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      {statusDescription(item.status)}
                    </p>
                  </div>

                  <div className="border-t border-gray-100 p-6 lg:border-l lg:border-t-0">
                    <div className="text-xs text-gray-400">
                      TREND HEAT
                    </div>

                    <div className="mt-2 text-3xl font-black">
                      {item.heat}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 p-6 lg:border-l lg:border-t-0">
                    <div className="text-xs text-gray-400">
                      7D NEWS
                    </div>

                    <div className="mt-2 text-3xl font-black">
                      {item.count7}
                    </div>

                    <div className="mt-1 text-xs text-gray-400">
                      24H +{item.recent24}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 bg-gray-50 p-6 lg:border-l lg:border-t-0">
                    <div className="text-xs text-gray-400">
                      GROWTH
                    </div>

                    <div className="mt-2 text-3xl font-black">
                      {item.growth > 0 ? "+" : ""}
                      {item.growth}%
                    </div>

                    <div className="mt-1 text-xs text-gray-400">
                      AI {formatScore(item.avgScore)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {trends.length === 0 && (
              <div className="border border-gray-200 p-12 text-center text-gray-500">
                暂无足够的产业趋势数据。
              </div>
            )}
          </div>
        </section>

        {/* METHODOLOGY */}

        <section className="mt-16 grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 md:grid-cols-3">
          <div className="bg-black p-7 text-white">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-500">
              01 · ACTIVITY
            </div>

            <h3 className="mt-3 text-xl font-black">
              产业活跃度
            </h3>

            <p className="mt-3 text-sm leading-6 text-gray-400">
              统计近7天与近30天相关资讯数量，观察产业方向的实际讨论密度。
            </p>
          </div>

          <div className="bg-white p-7">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-400">
              02 · MOMENTUM
            </div>

            <h3 className="mt-3 text-xl font-black">
              趋势变化
            </h3>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              对比当前7天与前7天的资讯数量，判断方向是在加速、稳定还是回落。
            </p>
          </div>

          <div className="bg-white p-7">
            <div className="text-xs font-bold tracking-[0.2em] text-gray-400">
              03 · INTELLIGENCE
            </div>

            <h3 className="mt-3 text-xl font-black">
              AI情报评分
            </h3>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              结合现有资讯AI评分，为趋势判断增加内容质量与重要性信号。
            </p>
          </div>
        </section>

        {/* FOOTER */}

        <footer className="mt-16 border-t border-gray-200 py-8 text-xs text-gray-400">
          AI Insight Daily · Industry Trend Intelligence
          <span className="mx-2">·</span>
          数据窗口：近30天
        </footer>
      </div>
    </main>
  );
}
