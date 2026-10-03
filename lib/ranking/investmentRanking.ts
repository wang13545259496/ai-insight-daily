export function rankInvestments(items: any[]) {
  return items
    .map((item) => ({
      ...item,

      rankingScore: Math.round(
        (item.businessScore +
          item.technologyScore +
          item.marketScore +
          item.growthScore -
          item.riskScore) /
          4,
      ),
    }))

    .sort((a, b) => b.rankingScore - a.rankingScore);
}
