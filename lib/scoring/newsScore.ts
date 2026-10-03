export interface NewsScoreInput {
  source?: string | null;

  sourceCount?: number | null;

  originalSourceCount?: number | null;

  verified?: boolean | null;

  createdAt?: Date | string | null;
}

export interface NewsScoreResult {
  score: number;

  level: string;

  reason: string;
}

export function calculateNewsScore(news: NewsScoreInput): NewsScoreResult {
  const sourceScore = getSourceScore(news.source);

  const multiSourceScore = Math.min(
    (news.sourceCount || 1) * 20,

    100,
  );

  const verifyScore = news.verified ? 100 : 50;

  const timeScore = calculateTimeScore(news.createdAt);

  const score = Math.round(
    sourceScore * 0.35 +
      multiSourceScore * 0.25 +
      verifyScore * 0.2 +
      timeScore * 0.2,
  );

  return {
    score,

    level: getLevel(score),

    reason: getReason(news, score),
  };
}

function getSourceScore(source?: string | null) {
  if (!source) {
    return 40;
  }

  const name = source.toLowerCase();

  if (
    name.includes("openai") ||
    name.includes("google") ||
    name.includes("microsoft") ||
    name.includes("anthropic")
  ) {
    return 100;
  }

  if (name.includes("百度") || name.includes("腾讯")) {
    return 90;
  }

  return 70;
}

function calculateTimeScore(date?: Date | string | null) {
  if (!date) {
    return 50;
  }

  const time = new Date(date).getTime();

  const now = Date.now();

  const hours = (now - time) / 1000 / 60 / 60;

  if (hours <= 24) {
    return 100;
  }

  if (hours <= 72) {
    return 80;
  }

  if (hours <= 168) {
    return 60;
  }

  return 40;
}

function getLevel(score: number) {
  if (score >= 85) {
    return "重点新闻";
  }

  if (score >= 70) {
    return "重要新闻";
  }

  if (score >= 50) {
    return "一般新闻";
  }

  return "低关注";
}

function getReason(
  news: NewsScoreInput,

  score: number,
) {
  const reasons: string[] = [];

  if ((news.sourceCount || 1) >= 3) {
    reasons.push("多源验证");
  }

  if (news.verified) {
    reasons.push("来源可信");
  }

  if (getSourceScore(news.source) >= 90) {
    reasons.push("权威机构发布");
  }

  if (reasons.length === 0) {
    reasons.push("系统持续跟踪");
  }

  return reasons.join("，");
}
