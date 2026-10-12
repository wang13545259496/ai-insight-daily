import { prisma } from "@/lib/prisma";
import { calculateHotScore } from "./hotScore";

function contentQuality(item: {
  title: string;
  summary: string;
  content: string;
  sourceUrl: string | null;
}) {
  let score = 0;

  if (item.title?.length >= 8) score += 25;
  if (item.summary?.length >= 30) score += 25;
  if (item.content?.length >= 100) score += 30;
  if (item.sourceUrl) score += 20;

  return score;
}

export async function getHotNews(limit = 20) {
  const news = await prisma.news.findMany({
    where: {
      dataStatus: "active",
    },
    take: 200,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      event: true,
      sourceRef: true,
    },
  });

  const result = news
    .map((item) => {
      const hotScore = calculateHotScore({
        createdAt: item.createdAt,
        sourceCount: item.sourceCount,
        originalSourceCount: item.originalSourceCount,
        verified: item.verified,
        aiScore: item.aiScore,
        contentQuality: contentQuality(item),
        eventHeat: item.event?.heatScore ?? 0,
        eventQuality: item.event?.qualityScore ?? 0,
        sourceWeight: item.sourceRef?.rssWeight ?? 100,
      });

      return {
        ...item,
        hotScore,
      };
    })
    .sort((a, b) => b.hotScore.finalScore - a.hotScore.finalScore)
    .slice(0, limit);

  return result;
}
