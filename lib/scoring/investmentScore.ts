export interface InvestmentScoreInput {
  businessScore?: number | null;
  technologyScore?: number | null;
  marketScore?: number | null;
  growthScore?: number | null;
  riskScore?: number | null;
}

export interface InvestmentScoreResult {
  score: number;
  level: string;
  reason: string;
}

export function calculateInvestmentScore(
  investment: InvestmentScoreInput,
): InvestmentScoreResult {
  const business = normalize(investment.businessScore);
  const technology = normalize(investment.technologyScore);
  const market = normalize(investment.marketScore);
  const growth = normalize(investment.growthScore);
  const risk = normalize(investment.riskScore);

  // riskScore：
  // 0 = 低风险
  // 100 = 高风险
  //
  // 投资评分中，风险越低越有利，
  // 因此转换为风险控制分。
  const riskControl = 100 - risk;

  // 统一投资评分模型：
  //
  // 商业模式 30%
  // 技术能力 25%
  // 市场空间 20%
  // 成长能力 15%
  // 风险控制 10%
  //
  // 总分 0 - 100
  const score = clamp(
    Math.round(
      business * 0.3 +
        technology * 0.25 +
        market * 0.2 +
        growth * 0.15 +
        riskControl * 0.1,
    ),
  );

  return {
    score,
    level: getLevel(score),
    reason: getReason(investment, score),
  };
}

function normalize(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Math.round(value);
}

function clamp(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function getLevel(score: number): string {
  if (score >= 90) {
    return "重点关注";
  }

  if (score >= 75) {
    return "高度关注";
  }

  if (score >= 60) {
    return "持续观察";
  }

  return "普通关注";
}

function getReason(
  investment: InvestmentScoreInput,
  score: number,
): string {
  const reasons: string[] = [];

  const business = normalize(investment.businessScore);
  const technology = normalize(investment.technologyScore);
  const market = normalize(investment.marketScore);
  const growth = normalize(investment.growthScore);
  const risk = normalize(investment.riskScore);

  if (business >= 80) {
    reasons.push("商业模式成熟");
  }

  if (technology >= 80) {
    reasons.push("技术能力较强");
  }

  if (market >= 80) {
    reasons.push("市场空间较大");
  }

  if (growth >= 80) {
    reasons.push("增长潜力较高");
  }

  if (risk <= 30) {
    reasons.push("风险水平较低");
  } else if (risk >= 70) {
    reasons.push("风险因素需要重点关注");
  }

  if (reasons.length === 0) {
    reasons.push(`当前综合投资评分为${score}分，系统持续跟踪其投资价值`);
  }

  return reasons.join("，");
}
