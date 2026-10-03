import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";

const prisma = new PrismaClient();

const parser = new Parser();

function normalizeTitle(title: string) {
  return title

    .toLowerCase()

    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")

    .trim();
}

async function main() {
  console.log("开始RSS历史来源自动修复...");

  const newsList = await prisma.news.findMany({
    where: {
      sourceUrl: null,

      dataStatus: "repair",
    },
  });

  console.log(`待修复新闻:${newsList.length}`);

  let success = 0;

  let failed = 0;

  for (const news of newsList) {
    const source = await prisma.source.findFirst({
      where: {
        name: news.source,
      },
    });

    if (!source || !source.rssUrl) {
      failed++;

      continue;
    }

    try {
      const feed = await parser.parseURL(source.rssUrl);

      const target = normalizeTitle(news.title);

      const match = feed.items.find((item) => {
        if (!item.title) {
          return false;
        }

        return normalizeTitle(item.title) === target;
      });

      if (match && match.link) {
        await prisma.news.update({
          where: {
            id: news.id,
          },

          data: {
            sourceUrl: match.link,

            dataStatus: "active",

            cleanReason: null,
          },
        });

        success++;

        console.log(
          `修复成功:

${news.title}`,
        );
      } else {
        failed++;
      }
    } catch (_error) {
      failed++;

      console.log(
        `RSS读取失败:

${news.source}`,
      );
    }
  }

  console.log(`

====================

修复完成


成功:
${success}


失败:
${failed}


====================

`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
