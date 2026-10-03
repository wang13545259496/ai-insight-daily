import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ==============================
// V7.4.8.10.5.5.8.6.7.3
// 历史新闻自动状态标记系统
// ==============================

interface QualityNews {
  sourceUrl:string|null;
  source:string;
  content:string;
}
function analyzeNews(news: QualityNews) {
  // 有来源链接

  if (news.sourceUrl) {
    return {
      status: "active",

      reason: null,
    };
  }

  // 有来源、有内容

  if (news.source && news.content && news.content.length >= 100) {
    return {
      status: "repair",

      reason: "缺少原始来源链接，但内容完整",
    };
  }

  return {
    status: "archived",

    reason: "缺少来源且内容不足",
  };
}

async function main() {
  console.log("开始历史新闻状态自动标记...");

  const newsList = await prisma.news.findMany({
    select: {
      id: true,

      title: true,

      source: true,

      sourceUrl: true,

      content: true,
    },
  });

  console.log(`待检测新闻:${newsList.length}`);

  let active = 0;

  let repair = 0;

  let archived = 0;

  for (const news of newsList) {
    const result = analyzeNews(news);

    await prisma.news.update({
      where: {
        id: news.id,
      },

      data: {
        dataStatus: result.status,

        cleanReason: result.reason,
      },
    });

    if (result.status === "active") {
      active++;
    }

    if (result.status === "repair") {
      repair++;
    }

    if (result.status === "archived") {
      archived++;
    }
  }

  console.log(`

============================

历史新闻状态更新完成


正常 active:

${active}


待修复 repair:

${repair}


归档 archived:

${archived}


============================

`);
}

main()
  .catch((error) => {
    console.error(error);
  })

  .finally(async () => {
    await prisma.$disconnect();
  });
