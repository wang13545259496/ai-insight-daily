import { prisma } from "@/lib/prisma";

function cleanHtml(html: string) {
  if (!html) {
    return "";
  }

  return (
    html

      // 删除script
      .replace(/<script[\s\S]*?<\/script>/gi, "")

      // 删除style
      .replace(/<style[\s\S]*?<\/style>/gi, "")

      // 删除图片
      .replace(/<img[^>]*>/gi, "")

      // 删除html标签
      .replace(/<[^>]+>/g, "")

      // 解码常见html
      .replace(/&nbsp;/g, " ")

      .replace(/&amp;/g, "&")

      .replace(/&lt;/g, "<")

      .replace(/&gt;/g, ">")

      // 多空格
      .replace(/\s+/g, " ")

      .trim()
  );
}

async function main() {
  console.log("开始清洗新闻正文...");

  const newsList = await prisma.news.findMany({
    take: 200,
  });

  console.log(`处理 ${newsList.length} 条新闻`);

  let count = 0;

  for (const news of newsList) {
    try {
      const cleaned = cleanHtml(news.content);

      const finalContent = cleaned || news.summary;

      await prisma.news.update({
        where: {
          id: news.id,
        },

        data: {
          content: finalContent,
        },
      });

      count++;

      console.log(
        `${count}/${newsList.length}`,

        news.title,
      );
    } catch (error) {
      console.log(
        "失败",

        news.id,
      );
    }
  }

  console.log("新闻正文清洗完成");

  await prisma.$disconnect();
}

main();
