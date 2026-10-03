"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface IndustryTrendItem {
  id: number;

  hotspotId: number;

  date: Date | string;

  score: number;

  hotspot?: {
    name: string;

    category: string;
  };
}

interface IndustryChartsProps {
  trends: IndustryTrendItem[];

  latest: IndustryTrendItem[];
}

export default function IndustryCharts({
  trends,

  latest,
}: IndustryChartsProps) {
  const trendData = trends.map((item) => ({
    date: new Date(item.date).toLocaleDateString(
      "zh-CN",

      {
        month: "numeric",

        day: "numeric",
      },
    ),

    score: item.score,
  }));

  const rankData = latest
    .map((item, index) => ({
      name: item.hotspot?.name || `AI方向${index + 1}`,

      score: item.score,
    }))

    .sort((a, b) => b.score - a.score);

  return (
    <>
      <section
        className="
        border
        border-gray-800
        rounded-2xl
        bg-zinc-950
        p-8
        mb-10
        "
      >
        <h2
          className="
          text-2xl
          font-bold
          mb-8
          "
        >
          AI产业趋势变化
        </h2>

        <div
          className="
          h-[400px]
          "
        >
          <ResponsiveContainer
            width="100%"

            height="100%"
          >
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="date" />

              <YAxis />

              <Tooltip />

              <Line
                type="monotone"

                dataKey="score"

                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section
        className="
        border
        border-gray-800
        rounded-2xl
        bg-zinc-950
        p-8
        "
      >
        <h2
          className="
          text-2xl
          font-bold
          mb-8
          "
        >
          AI产业方向排行榜
        </h2>

        <div
          className="
          h-[450px]
          "
        >
          <ResponsiveContainer
            width="100%"

            height="100%"
          >
            <BarChart
              data={rankData}

              layout="vertical"

              margin={{
                left: 40,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis type="number" />

              <YAxis
                type="category"

                dataKey="name"

                width={100}
              />

              <Tooltip />

              <Bar dataKey="score">
                {rankData.map((item) => (
                  <Cell key={item.name} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
