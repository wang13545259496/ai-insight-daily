import { prisma } from "@/lib/prisma";

async function main() {
  console.log("开始检查新闻正文...");

  const newsList = await prisma.news.findMany({
    where: {
      content: "",
    },

    take: 100,
  });

  console.log(`发现 ${newsList.length} 条缺少正文新闻`);

  let success = 0;

  for (const news of newsList) {
    try {
      const content = `

${news.summary}


背景：

${news.background || "暂无背景信息"}



来源：

${news.source}



原始链接：

${news.sourceUrl || "暂无"}



AI Insight Daily 自动整理。

`;

      await prisma.news.update({
        where: {
          id: news.id,
        },

        data: {
          content,
        },
      });

      success++;

      console.log(
        `完成 ${success}/${newsList.length}`,

        news.title,
      );
    } catch (error) {
      console.log(
        "失败:",

        news.id,

        error,
      );
    }
  }

  console.log("新闻正文补全完成");

  await prisma.$disconnect();
}

main();
