export interface HotScore {
  views: number;
  engagement: number;
  shareScore: number;
  finalScore: number;
  recencyScore: number;
  sourceScore: number;
  qualityScore: number;
}

export interface RealHotSignals {
  createdAt?: Date | string;
  sourceCount?: number;
  originalSourceCount?: number;
  verified?: boolean;
  aiScore?: number;
  contentQuality?: number;
  eventHeat?: number;
  eventQuality?: number;
  sourceWeight?: number;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function calculateHotScore(
  data: RealHotSignals | {
    views: number;
    likes: number;
    favorites: number;
    shares: number;
    comments: number;
  }
): HotScore {
  if ("views" in data) {
    const engagement =
      data.likes * 2 +
      data.favorites * 3 +
      data.comments * 2;

    const shareScore = data.shares * 5;

    const finalScore =
      data.views * 0.4 +
      engagement * 0.3 +
      shareScore * 0.3;

    return {
      views: data.views,
      engagement,
      shareScore,
      finalScore: Number(finalScore.toFixed(2)),
      recencyScore: 0,
      sourceScore: 0,
      qualityScore: 0,
    };
  }

  const now = Date.now();
  const created = data.createdAt
    ? new Date(data.createdAt).getTime()
    : now;

  const ageHours = Math.max(0, (now - created) / 3600000);

  const recencyScore = clamp(
    100 * Math.exp(-ageHours / 36)
  );

  const sourceCount =
    Math.max(
      1,
      Number(data.sourceCount ?? data.originalSourceCount ?? 1)
    );

  const sourceScore = clamp(
    35 +
      Math.min(40, Math.log2(sourceCount) * 18) +
      Math.min(25, Number(data.sourceWeight ?? 0) / 4)
  );

  const qualityScore = clamp(
    Number(data.aiScore ?? 0) * 0.55 +
      Number(data.contentQuality ?? 0) * 0.2 +
      Number(data.eventQuality ?? 0) * 0.1 +
      (data.verified ? 15 : 0)
  );

  const eventScore = clamp(
    Number(data.eventHeat ?? 0)
  );

  const finalScore = clamp(
    recencyScore * 0.30 +
      sourceScore * 0.20 +
      qualityScore * 0.30 +
      eventScore * 0.20
  );

  return {
    views: 0,
    engagement: 0,
    shareScore: 0,
    finalScore: Number(finalScore.toFixed(2)),
    recencyScore: Number(recencyScore.toFixed(2)),
    sourceScore: Number(sourceScore.toFixed(2)),
    qualityScore: Number(qualityScore.toFixed(2)),
  };
}
