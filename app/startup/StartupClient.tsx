"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

type StartupItem = {
  id: number;

  industry: string;

  opportunity: string;

  trend: string;

  direction: string;

  description: string;

  report: any;

  investment: any;

  createdAt: string;
};

export default function StartupClient({ data }: { data: StartupItem[] }) {
  const categories = [
    "全部",

    ...Array.from(new Set(data.map((item) => item.industry))),
  ];

  const [active, setActive] = useState("全部");

  function trendScore(item: StartupItem) {
    let score = 50;

    if (item.trend) {
      if (item.trend.includes("高速") || item.trend.includes("快速")) {
        score += 35;
      } else if (item.trend.includes("增长")) {
        score += 25;
      } else if (item.trend.includes("持续")) {
        score += 15;
      }
    }

    return Math.min(score, 100);
  }

  function reportScore(item: StartupItem) {
    if (!item.report) {
      return 40;
    }

    let score = 50;

    if (item.report.marketAnalysis) {
      score += 10;
    }

    if (item.report.aiSolution) {
      score += 10;
    }

    if (item.report.productDesign) {
      score += 10;
    }

    if (item.report.businessModel) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  function investmentScore(item: StartupItem) {
    if (!item.investment) {
      return 40;
    }

    return Math.round(
      (item.investment.businessScore +
        item.investment.technologyScore +
        item.investment.marketScore +
        item.investment.growthScore) /
        4,
    );
  }

  function startupIndex(item: StartupItem) {
    return Math.round(
      (trendScore(item) + reportScore(item) + investmentScore(item)) / 3,
    );
  }

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => startupIndex(b) - startupIndex(a));
  }, [data]);

  const filtered =
    active === "全部"
      ? sortedData
      : sortedData.filter((item) => item.industry === active);

  return (
    <div>
      {/* 行业筛选 */}

      <div
        className="
mb-12
"
      >
        <h2
          className="
text-2xl
font-bold
mb-5
"
        >
          创业方向筛选
        </h2>

        <div
          className="
flex
flex-wrap
gap-3
"
        >
          {categories.map((category) => (
            <button
              key={category}

              onClick={() => setActive(category)}

              className={`

px

-5

py-2

rounded-full

border

transition

${active === category ? "bg-white text-black" : "border-gray-700 text-gray-300"}

`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* 排行榜 */}

      <div
        className="
mb-12
"
      >
        <h2
          className="
text-3xl
font-bold
"
        >
          AI创业潜力排行榜
        </h2>

        <p
          className="
mt-3
text-gray-500
"
        >
          基于产业趋势、商业方案和投资价值综合计算
        </p>
      </div>

      <div
        className="
grid
grid-cols-1
md:grid-cols-2
lg:grid-cols-3
gap-6
"
      >
        {filtered.map((item, index) => (
          <div
            key={item.id}

            className="
border
border-gray-800
rounded-2xl
p-7
bg-gray-950
hover:border-gray-500
transition
"
          >
            <div
              className="
flex
justify-between
"
            >
              <div>
                <p
                  className="
text-gray-500
text-sm
"
                >
                  TOP {index + 1}
                </p>

                <h2
                  className="
text-2xl
font-bold
mt-2
"
                >
                  {item.opportunity}
                </h2>
              </div>

              <div
                className="
text-right
"
              >
                <p
                  className="
text-gray-500
text-xs
"
                >
                  创业指数
                </p>

                <p
                  className="
text-4xl
font-bold
"
                >
                  {startupIndex(item)}
                </p>
              </div>
            </div>

            <div
              className="
mt-7
space-y-3
text-sm
"
            >
              <p>
                <span
                  className="
text-gray-500
"
                >
                  行业：
                </span>

                {item.industry}
              </p>

              <p>
                <span
                  className="
text-gray-500
"
                >
                  趋势：
                </span>

                {item.trend || "暂无"}
              </p>

              <p>
                <span
                  className="
text-gray-500
"
                >
                  方向：
                </span>

                {item.direction || "暂无"}
              </p>
            </div>

            <div
              className="
mt-7
border
border-gray-800
rounded-xl
p-5
"
            >
              <h3
                className="
font-bold
mb-5
"
              >
                创业评分
              </h3>

              <ScoreBar
                title="趋势热度"

                score={trendScore(item)}
              />

              <ScoreBar
                title="商业方案"

                score={reportScore(item)}
              />

              <ScoreBar
                title="投资价值"

                score={investmentScore(item)}
              />
            </div>

            <p
              className="
mt-6
text-gray-300
leading-7
line-clamp-3
"
            >
              {item.description || "暂无创业方向描述"}
            </p>

            <Link
              href={`/startup/${item.id}`}

              className="
inline-block
mt-7
border
border-gray-700
rounded-lg
px-5
py-3
hover:bg-white
hover:text-black
transition
"
            >
              查看创业方案 →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({
  title,

  score,
}: {
  title: string;

  score: number;
}) {
  return (
    <div
      className="
mb-5
"
    >
      <div
        className="
flex
justify-between
text-sm
mb-2
"
      >
        <span>{title}</span>

        <span>{score}</span>
      </div>

      <div
        className="
h-2
rounded-full
bg-gray-800
overflow-hidden
"
      >
        <div
          className="
h-full
bg-white
"

          style={{
            width: `${score}%`,
          }}
        />
      </div>
    </div>
  );
}
