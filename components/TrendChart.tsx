"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface TrendPoint {
  date: string;
  count: number;
}
export default function TrendChart({ data }: { data: TrendPoint[] }) {
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
        📈 AI新闻增长趋势
      </h3>

      <div
        className="
h-[280px]
"
      >
        <ResponsiveContainer
          width="100%"

          height="100%"
        >
          <LineChart data={data}>
            <CartesianGrid />

            <XAxis dataKey="date" />

            <YAxis />

            <Tooltip />

            <Line
              type="monotone"

              dataKey="count"

              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
