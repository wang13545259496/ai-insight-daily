import { prisma } from "@/lib/prisma";
import { analyzeNews } from "@/lib/news/analyzeNews";

async function main() {
  const newsList = await prisma.news.findMany({
    where: {
      analysisStatus: "pending",
    },

    orderBy: {
      createdAt: "desc",
    },

    take: 50,
  });

  console.log(`发现 ${newsList.length} 条待分析新闻`);

  for (const news of newsList) {
    try {
      console.log("正在分析:", news.id, news.title);

      await analyzeNews({
        newsId: news.id,
      });

      console.log("完成:", news.id);
    } catch (error) {
      console.error("失败:", news.id, error);
    }
  }

  console.log("AI新闻增强完成");
}

main().finally(() => prisma.$disconnect());
