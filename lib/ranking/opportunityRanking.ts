export function rankOpportunities(items: any[]) {
  return items
    .map((item) => ({
      ...item,

      rankingScore: Math.min(
        100,

        50 +
          (item.description?.length || 0) / 5 +
          (item.trend?.length || 0) * 2,
      ),
    }))

    .sort((a, b) => b.rankingScore - a.rankingScore);
}
