import {
  calculateInvestmentScore,
} from "@/lib/scoring/investmentScore";

export function rankInvestments(items: any[]) {
  return items
    .map((item) => {
      const result = calculateInvestmentScore({
        businessScore: item.businessScore,
        technologyScore: item.technologyScore,
        marketScore: item.marketScore,
        growthScore: item.growthScore,
        riskScore: item.riskScore,
      });

      return {
        ...item,
        rankingScore: result.score,
        rankingLevel: result.level,
        rankingReason: result.reason,
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore);
}
