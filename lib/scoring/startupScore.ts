export interface StartupScoreInput {
  marketScore?: number | null;

  businessScore?: number | null;

  technologyScore?: number | null;

  growthScore?: number | null;
}

export interface StartupScoreResult {
  score: number;

  level: string;

  reason: string;
}

export function calculateStartupScore(
  startup: StartupScoreInput,
): StartupScoreResult {
  const market = normalize(startup.marketScore);

  const business = normalize(startup.businessScore);

  const technology = normalize(startup.technologyScore);

  const growth = normalize(startup.growthScore);

  const score = Math.round(
    market * 0.3 + business * 0.25 + technology * 0.25 + growth * 0.2,
  );

  return {
    score,

    level: getLevel(score),

    reason: getReason(startup),
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
    return "创业重点方向";
  }

  if (score >= 75) {
    return "高潜力创业方向";
  }

  if (score >= 60) {
    return "潜力创业方向";
  }

  return "观察方向";
}

function getReason(startup: StartupScoreInput) {
  const reasons: string[] = [];

  if ((startup.marketScore || 0) >= 80) {
    reasons.push("市场需求强");
  }

  if ((startup.businessScore || 0) >= 80) {
    reasons.push("商业模式明确");
  }

  if ((startup.technologyScore || 0) >= 80) {
    reasons.push("技术壁垒较高");
  }

  if ((startup.growthScore || 0) >= 80) {
    reasons.push("增长空间较大");
  }

  if (reasons.length === 0) {
    reasons.push("系统持续分析创业潜力");
  }

  return reasons.join("，");
}
