"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

export interface CategoryHeatItem {
  name: string;
  value: number;
  newsCount?: number;
}
export default function CategoryHeatChart({ data }: { data: CategoryHeatItem[] }) {
  if (!data || data.length === 0) {
    return (
      <div
        className="
border
border-gray-800
rounded-xl
p-6
mt-6
h-72
flex
items-center
justify-center
text-gray-400
"
      >
        📊 暂无AI领域热度数据
      </div>
    );
  }

  return (
    <div
      className="
border
border-gray-800
rounded-xl
p-5
mt-6
"
    >
      <h3
        className="
text-lg
font-bold
mb-4
"
      >
        🔥 AI领域热度排行
      </h3>

      <div
        className="
h-[320px]
"
      >
        <ResponsiveContainer
          width="100%"

          height="100%"
        >
          <BarChart
            data={[...data].reverse()}

            layout="vertical"

            margin={{
              left: 20,

              right: 30,
            }}
          >
            <CartesianGrid />

            <XAxis type="number" />

            <YAxis
              dataKey="name"

              type="category"

              width={90}
            />

            <Tooltip
              formatter={(value) => [`${String(value)} 热度`, "AI指数"]}
            />

            <Bar
              dataKey="value"

              barSize={24}
            >
              {data.map((item, index) => (
                <Cell key={index} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        className="
mt-4
grid
grid-cols-2
md:grid-cols-4
gap-3
"
      >
        {data.slice(0, 4).map((item) => (
          <div
            key={item.name}

            className="
border
border-gray-800
rounded-lg
p-3
"
          >
            <div
              className="
text-sm
text-gray-400
"
            >
              {item.name}
            </div>

            <div
              className="
text-xl
font-bold
"
            >
              {item.value}
            </div>

            <div
              className="
text-xs
text-gray-400
"
            >
              {item.newsCount || 0} 篇新闻
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
