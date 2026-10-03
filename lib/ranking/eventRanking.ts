export function rankEvents(events: any[]) {
  return events
    .map((item) => ({
      ...item,

      rankingScore: Math.round(
        (item.heatScore || 0) * 0.6 + (item.qualityScore || 0) * 0.4,
      ),
    }))

    .sort((a, b) => b.rankingScore - a.rankingScore);
}
