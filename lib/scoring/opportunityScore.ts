export interface OpportunityScoreInput {
  industry?: string | null;

  opportunity?: string | null;

  trend?: string | null;

  direction?: string | null;

  description?: string | null;

  createdAt?: Date | string | null;
}

export interface OpportunityScoreResult {
  score: number;

  level: string;

  reason: string;
}

export function calculateOpportunityScore(
  item: OpportunityScoreInput,
): OpportunityScoreResult {
  const trendScore = getTrendScore(item.trend);

  const directionScore = getDirectionScore(item.direction);

  const contentScore = getContentScore(item);

  const freshnessScore = getFreshnessScore(item.createdAt);

  const score = Math.round(
    trendScore * 0.35 +
      directionScore * 0.3 +
      contentScore * 0.2 +
      freshnessScore * 0.15,
  );

  return {
    score,

    level: getLevel(score),

    reason: getReason(
      item,

      score,
    ),
  };
}

function getTrendScore(trend?: string | null) {
  if (!trend) {
    return 50;
  }

  const value = trend.toLowerCase();

  if (
    value.includes("上升") ||
    value.includes("增长") ||
    value.includes("hot") ||
    value.includes("rising")
  ) {
    return 100;
  }

  if (value.includes("稳定") || value.includes("stable")) {
    return 70;
  }

  if (value.includes("下降") || value.includes("fall")) {
    return 40;
  }

  return 60;
}

function getDirectionScore(direction?: string | null) {
  if (!direction) {
    return 50;
  }

  const keywords = [
    "agent",

    "智能体",

    "企业",

    "自动化",

    "平台",

    "模型",

    "服务",
  ];

  const count = keywords.filter((item) =>
    direction.toLowerCase().includes(item),
  ).length;

  return Math.min(
    60 + count * 10,

    100,
  );
}

function getContentScore(item: OpportunityScoreInput) {
  let score = 40;

  if (item.industry) {
    score += 15;
  }

  if (item.opportunity) {
    score += 15;
  }

  if (item.description) {
    score += 30;
  }

  return Math.min(score, 100);
}

function getFreshnessScore(date?: Date | string | null) {
  if (!date) {
    return 50;
  }

  const days = (Date.now() - new Date(date).getTime()) / 1000 / 60 / 60 / 24;

  if (days <= 7) {
    return 100;
  }

  if (days <= 30) {
    return 80;
  }

  if (days <= 90) {
    return 60;
  }

  return 40;
}

function getLevel(score: number) {
  if (score >= 85) {
    return "重点机会";
  }

  if (score >= 70) {
    return "高价值机会";
  }

  if (score >= 55) {
    return "潜力机会";
  }

  return "观察机会";
}

function getReason(
  item: OpportunityScoreInput,

  score: number,
) {
  const reasons: string[] = [];

  if (item.trend) {
    reasons.push(`趋势：${item.trend}`);
  }

  if (item.direction) {
    reasons.push(`方向：${item.direction}`);
  }

  if (item.industry) {
    reasons.push(`行业：${item.industry}`);
  }

  if (reasons.length === 0) {
    reasons.push("系统持续分析产业机会");
  }

  return reasons.join("，");
}
