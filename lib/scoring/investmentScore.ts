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

  let score = Math.round(
    business * 0.3 + technology * 0.25 + market * 0.25 + growth * 0.2,
  );

  // 风险修正

  if (risk >= 80) {
    score = Math.round(score * 0.85);
  }

  if (score > 100) {
    score = 100;
  }

  if (score < 0) {
    score = 0;
  }

  return {
    score,

    level: getLevel(score),

    reason: getReason(
      investment,

      score,
    ),
  };
}

function normalize(value: number | null | undefined) {
  if (!value) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function getLevel(score: number) {
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
) {
  const reasons: string[] = [];

  if ((investment.businessScore || 0) >= 80) {
    reasons.push("商业模式成熟");
  }

  if ((investment.technologyScore || 0) >= 80) {
    reasons.push("技术能力较强");
  }

  if ((investment.marketScore || 0) >= 80) {
    reasons.push("市场空间较大");
  }

  if ((investment.growthScore || 0) >= 80) {
    reasons.push("增长潜力较高");
  }

  if ((investment.riskScore || 0) >= 80) {
    reasons.push("风险因素需要关注");
  }

  if (reasons.length === 0) {
    reasons.push("系统持续分析投资价值");
  }

  return reasons.join("，");
}
