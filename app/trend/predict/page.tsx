import SectionTitle from "@/components/SectionTitle";
import PredictionCard from "@/components/PredictionCard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HotspotWithTrend = {
  id: number;
  name: string;
  category: string;
  keywords: string;
  score: number;
  trend: string;
  newsCount: number;
  recentNewsCount: number;
  eventCount: number;
  companyScore: number;
  description: string | null;
  trends: {
    id: number;
    date: Date;
    score: number;
  }[];
};

type PredictionItem = {
  id: number;
  title: string;
  probability: string;
  trend: string;
  description: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }

  return clamp(value / max, 0, 1);
}

function getTodayStart() {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function getTomorrowStart() {
  const today = getTodayStart();

  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );
}

/**
 * 第二阶段：
 * 每天第一次访问预测页面时，为每个产业热点保存一次当天趋势快照。
 *
 * 不修改已有记录。
 * 同一天如果已经存在记录，则不会重复写入。
 */
async function saveDailyTrendSnapshots(hotspots: HotspotWithTrend[]) {
  const todayStart = getTodayStart();
  const tomorrowStart = getTomorrowStart();

  await Promise.all(
    hotspots.map(async (hotspot) => {
      const existing = await prisma.industryTrend.findFirst({
        where: {
          hotspotId: hotspot.id,
          date: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        await prisma.industryTrend.create({
          data: {
            hotspotId: hotspot.id,
            date: new Date(),
            score: hotspot.score,
          },
        });
      }
    })
  );
}

/**
 * 计算历史趋势变化。
 *
 * 只有至少两条不同时间的记录时，
 * 才把历史变化纳入预测评分。
 */
function getHistoricalMomentum(
  trends: { date: Date; score: number }[]
) {
  if (!trends || trends.length < 2) {
    return {
      momentum: 0,
      hasHistory: false,
      change: 0,
    };
  }

  const sorted = [...trends].sort(
    (a, b) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime()
  );

  const first = sorted[0];
  const latest = sorted[sorted.length - 1];

  const change = latest.score - first.score;

  const momentum = clamp(change / 20, -1, 1);

  return {
    momentum,
    hasHistory: true,
    change,
  };
}

function getTrendLabel(
  currentTrend: string,
  momentum: number,
  hasHistory: boolean
) {
  if (hasHistory) {
    if (momentum >= 0.35) {
      return "高速增长";
    }

    if (momentum >= 0.1) {
      return "持续增长";
    }

    if (momentum <= -0.35) {
      return "明显回落";
    }

    if (momentum <= -0.1) {
      return "增长放缓";
    }
  }

  if (currentTrend === "up") {
    return "增长";
  }

  if (currentTrend === "down") {
    return "回落";
  }

  return "稳定";
}

function buildDescription(
  hotspot: HotspotWithTrend,
  probability: number,
  trendLabel: string,
  hasHistory: boolean,
  change: number
) {
  const parts: string[] = [];

  parts.push(
    `${hotspot.name}当前产业热度${Math.round(
      hotspot.score
    )}，近期相关新闻${hotspot.recentNewsCount}条。`
  );

  if (hotspot.newsCount > 0) {
    parts.push(
      `累计相关资讯${hotspot.newsCount}条`
    );
  }

  if (hotspot.eventCount > 0) {
    parts.push(
      `，关联产业事件${hotspot.eventCount}个`
    );
  }

  if (hotspot.companyScore > 0) {
    parts.push(
      `，企业关注度${hotspot.companyScore}`
    );
  }

  if (hasHistory) {
    if (change > 0) {
      parts.push(
        `。历史趋势评分较早期上升${Math.round(
          change
        )}分`
      );
    } else if (change < 0) {
      parts.push(
        `。历史趋势评分较早期下降${Math.abs(
          Math.round(change)
        )}分`
      );
    } else {
      parts.push("。历史趋势评分保持稳定");
    }
  } else {
    parts.push(
      "。当前历史样本仍在积累，预测结果主要依据当前产业热度与近期产业活跃度"
    );
  }

  parts.push(
    `。综合判断为${trendLabel}，当前预测评分${probability}分。`
  );

  return parts.join("");
}

/**
 * 第一阶段核心算法：
 *
 * 当前产业强度：
 * - score
 * - recentNewsCount
 * - newsCount
 * - companyScore
 *
 * 第二阶段增强：
 * - IndustryTrend 历史变化
 *
 * 注意：
 * 这里的“预测评分”是产业趋势评分，
 * 不是统计学意义上的概率。
 */
function calculatePrediction(
  hotspot: HotspotWithTrend
): PredictionItem {
  const historical = getHistoricalMomentum(
    hotspot.trends
  );

  const scoreComponent = normalize(
    hotspot.score,
    100
  );

  const recentNewsComponent = normalize(
    hotspot.recentNewsCount,
    300
  );

  const totalNewsComponent = normalize(
    hotspot.newsCount,
    1200
  );

  const companyComponent = normalize(
    hotspot.companyScore,
    100
  );

  const eventComponent = normalize(
    hotspot.eventCount,
    50
  );

  const trendBase =
    hotspot.trend === "up"
      ? 1
      : hotspot.trend === "down"
        ? 0
        : 0.5;

  /**
   * 第一阶段：
   * 当前产业强度占主要权重。
   *
   * 第二阶段：
   * 有足够历史数据后，提高历史趋势变化权重。
   */
  let rawScore =
    scoreComponent * 38 +
    recentNewsComponent * 22 +
    totalNewsComponent * 12 +
    companyComponent * 8 +
    eventComponent * 5 +
    trendBase * 10;

  if (historical.hasHistory) {
    rawScore =
      rawScore * 0.82 +
      historical.momentum * 10 +
      8;
  } else {
    rawScore += 5;
  }

  const probability = Math.round(
    clamp(rawScore, 0, 99)
  );

  const trendLabel = getTrendLabel(
    hotspot.trend,
    historical.momentum,
    historical.hasHistory
  );

  const title =
    hotspot.name === "AI智能体 Agent"
      ? "AI Agent成为下一代应用入口"
      : `${hotspot.name}持续成为AI产业重要方向`;

  const description = buildDescription(
    hotspot,
    probability,
    trendLabel,
    historical.hasHistory,
    historical.change
  );

  return {
    id: hotspot.id,
    title,
    probability: `${probability}%`,
    trend: trendLabel,
    description,
  };
}

export default async function PredictionPage() {
  const hotspots =
    (await prisma.industryHotspot.findMany({
      orderBy: [
        {
          score: "desc",
        },
        {
          recentNewsCount: "desc",
        },
      ],
      include: {
        trends: {
          orderBy: {
            date: "asc",
          },
          select: {
            id: true,
            date: true,
            score: true,
          },
        },
      },
    })) as HotspotWithTrend[];

  /**
   * 第二阶段：
   * 每日保存一次当前产业趋势快照。
   *
   * 这一步必须发生在读取预测历史之前，
   * 所以今天的数据会立即进入趋势样本。
   */
  if (hotspots.length > 0) {
    await saveDailyTrendSnapshots(hotspots);
  }

  /**
   * 保存完当天快照后重新读取历史数据，
   * 确保页面立即使用最新趋势样本。
   */
  const updatedHotspots =
    (await prisma.industryHotspot.findMany({
      orderBy: [
        {
          score: "desc",
        },
        {
          recentNewsCount: "desc",
        },
      ],
      include: {
        trends: {
          orderBy: {
            date: "asc",
          },
          select: {
            id: true,
            date: true,
            score: true,
          },
        },
      },
    })) as HotspotWithTrend[];

  const predictions = updatedHotspots
    .map(calculatePrediction)
    .filter((item) => item.probability !== "0%");

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="mt-8">
          <SectionTitle
            title="AI预测引擎"
            desc="基于AI产业热度、近期资讯、企业关注度与历史趋势，判断未来AI产业方向"
          />

          <div className="mb-8 mt-6 border border-white/10 bg-white/[0.03] px-5 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                  PREDICTION ENGINE
                </div>

                <div className="mt-2 text-sm leading-6 text-white/70">
                  当前预测评分基于真实产业数据计算。随着每日趋势数据持续积累，
                  系统会逐步加入历史趋势变化进行判断。
                </div>
              </div>

              <div className="shrink-0 text-xs text-white/40">
                数据来源：IndustryHotspot / IndustryTrend
              </div>
            </div>
          </div>

          {predictions.length === 0 ? (
            <div className="border border-white/10 bg-white/[0.03] p-10 text-center">
              <div className="text-sm text-white/50">
                暂无足够的产业数据生成预测
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {predictions.map((item) => (
                <PredictionCard
                  key={item.id}
                  title={item.title}
                  probability={item.probability}
                  trend={item.trend}
                  description={item.description}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
