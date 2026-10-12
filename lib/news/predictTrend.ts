import { prisma } from "@/lib/prisma";
import { calculateTrend } from "./trend";

function scoreNews(
  item: {
    aiScore: number;
    sourceCount: number;
    verified: boolean;
  }
) {
  return (
    Number(item.aiScore || 0) +
    Math.min(30, Math.max(0, item.sourceCount || 1) * 5) +
    (item.verified ? 10 : 0)
  );
}

export async function getNewsTrend() {
  const now = Date.now();
  const currentStart = new Date(now - 24 * 60 * 60 * 1000);
  const previousStart = new Date(now - 48 * 60 * 60 * 1000);

  const current = await prisma.news.findMany({
    where: {
      createdAt: {
        gte: currentStart,
      },
      dataStatus: "active",
    },
    select: {
      id: true,
      title: true,
      aiScore: true,
      sourceCount: true,
      verified: true,
      eventId: true,
    },
  });

  const previous = await prisma.news.findMany({
    where: {
      createdAt: {
        gte: previousStart,
        lt: currentStart,
      },
      dataStatus: "active",
    },
    select: {
      eventId: true,
      aiScore: true,
      sourceCount: true,
      verified: true,
    },
  });

  const currentMap = new Map<number, number>();
  const previousMap = new Map<number, number>();

  for (const item of current) {
    if (!item.eventId) continue;

    currentMap.set(
      item.eventId,
      (currentMap.get(item.eventId) || 0) + scoreNews(item)
    );
  }

  for (const item of previous) {
    if (!item.eventId) continue;

    previousMap.set(
      item.eventId,
      (previousMap.get(item.eventId) || 0) + scoreNews(item)
    );
  }

  const events = await prisma.newsEvent.findMany({
    where: {
      id: {
        in: Array.from(currentMap.keys()),
      },
    },
    take: 50,
  });

  return events
    .map((event) => {
      const currentScore = currentMap.get(event.id) || 0;
      const previousScore = previousMap.get(event.id) || 0;

      return {
        id: event.id,
        title: event.title,
        trend: calculateTrend({
          current: currentScore,
          previous: previousScore,
        }),
      };
    })
    .sort((a, b) => b.trend.growth - a.trend.growth);
}
