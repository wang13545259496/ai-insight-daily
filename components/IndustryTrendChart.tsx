"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface IndustryTrendPoint {
  date: string;
  score: number;
}
export default function IndustryTrendChart({ data }: { data: IndustryTrendPoint[] }) {
  return (
    <div
      className="
h-80
border
border-gray-800
rounded-2xl
p-5
bg-zinc-950
"
    >
      <ResponsiveContainer
        width="100%"

        height="100%"
      >
        <LineChart data={data}>
          <XAxis dataKey="date" />

          <YAxis />

          <Tooltip />

          <Legend />

          <Line
            type="monotone"

            dataKey="score"

            name="产业热度"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
