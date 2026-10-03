import { prisma } from "@/lib/prisma";

export async function getTrendData() {
  // 最近30天

  const startDate = new Date();

  startDate.setDate(startDate.getDate() - 30);

  const news = await prisma.news.findMany({
    where: {
      createdAt: {
        gte: startDate,
      },
    },

    orderBy: {
      createdAt: "asc",
    },

    select: {
      createdAt: true,
    },
  });

  const map: Record<string, number> = {};

  // 初始化30天日期

  for (let i = 0; i <= 30; i++) {
    const date = new Date();

    date.setDate(date.getDate() - i);

    const key = date.toISOString().split("T")[0];

    map[key] = 0;
  }

  // 统计新闻数量

  news.forEach((item) => {
    const date = item.createdAt

      .toISOString()

      .split("T")[0];

    if (map[date] !== undefined) {
      map[date]++;
    }
  });

  return Object.keys(map)

    .sort()

    .map((date) => ({
      date,

      count: map[date],
    }));
}
