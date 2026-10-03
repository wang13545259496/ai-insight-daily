"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

type Opportunity = {
  id: number;

  industry: string;

  opportunity: string;

  trend: string;

  direction: string;

  description: string;

  createdAt: string;
};

export default function OpportunityMapClient({
  data,
}: {
  data: Opportunity[];
}) {
  const categories = [
    "全部",

    ...Array.from(new Set(data.map((item) => item.industry))),
  ];

  const [active, setActive] = useState("全部");

  function trendScore(trend: string) {
    if (!trend) {
      return 50;
    }

    if (trend.includes("高速") || trend.includes("快速")) {
      return 90;
    }

    if (trend.includes("增长")) {
      return 75;
    }

    if (trend.includes("持续")) {
      return 65;
    }

    return 55;
  }

  function marketScore(item: Opportunity) {
    let score = 50;

    if (item.description) {
      score += 25;
    }

    if (item.industry) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  function aiIndex(item: Opportunity) {
    return Math.round((trendScore(item.trend) + marketScore(item)) / 2);
  }

  function businessValue(item: Opportunity) {
    return Math.round((aiIndex(item) + marketScore(item)) / 2);
  }

  function opportunityScore(item: Opportunity) {
    return Math.round((aiIndex(item) + businessValue(item)) / 2);
  }

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => opportunityScore(b) - opportunityScore(a));
  }, [data]);

  const filtered =
    active === "全部"
      ? sortedData
      : sortedData.filter((item) => item.industry === active);

  return (
    <div>
      {/* 分类导航 */}

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
          热门产业方向
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

px-5

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

      {/* 机会列表 */}

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
items-start
"
            >
              <div>
                <p
                  className="
text-sm
text-gray-500
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
text-xs
text-gray-500
"
                >
                  机会指数
                </p>

                <p
                  className="
text-3xl
font-bold
"
                >
                  {opportunityScore(item)}
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
mt-8
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
                AI商业评分
              </h3>

              <ScoreBar
                title="产业热度"

                score={aiIndex(item)}
              />

              <ScoreBar
                title="市场价值"

                score={marketScore(item)}
              />

              <ScoreBar
                title="商业潜力"

                score={businessValue(item)}
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
              {item.description || "暂无机会描述"}
            </p>

            <Link
              href={`/opportunity-map/${item.id}`}

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
              查看机会详情 →
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
