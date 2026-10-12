export type TrendLevel =
  | "爆发增长"
  | "上升趋势"
  | "稳定趋势"
  | "热度下降";

export interface TrendResult {
  growth: number;
  level: TrendLevel;
  prediction: string;
}

export function calculateTrend(data: {
  current: number;
  previous: number;
}): TrendResult {
  const current = Math.max(0, Number(data.current || 0));
  const previous = Math.max(0, Number(data.previous || 0));

  if (previous === 0 && current === 0) {
    return {
      growth: 0,
      level: "稳定趋势",
      prediction: "当前暂无明显热度变化。",
    };
  }

  if (previous === 0 && current > 0) {
    return {
      growth: 100,
      level: "爆发增长",
      prediction: "新近形成热点，未来24小时值得重点观察。",
    };
  }

  const growth = ((current - previous) / previous) * 100;

  if (growth >= 50) {
    return {
      growth: Number(growth.toFixed(2)),
      level: "爆发增长",
      prediction: "未来24小时可能继续升温。",
    };
  }

  if (growth >= 15) {
    return {
      growth: Number(growth.toFixed(2)),
      level: "上升趋势",
      prediction: "关注后续新闻数量和多源传播情况。",
    };
  }

  if (growth >= -15) {
    return {
      growth: Number(growth.toFixed(2)),
      level: "稳定趋势",
      prediction: "当前热度总体稳定。",
    };
  }

  return {
    growth: Number(growth.toFixed(2)),
    level: "热度下降",
    prediction: "近期关注度下降，继续观察是否出现新的事件进展。",
  };
}
