import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ==============================
// V7.4.8.10.5.5.8.6.7.2
// 历史无来源新闻质量检测
// ==============================

interface SourceLessNews {
  sourceUrl:string|null;
  source:string;
  content:string;
}
function checkNews(news: SourceLessNews) {
  const result = {
    type: "",

    reason: "",
  };

  // 已有来源链接

  if (news.sourceUrl) {
    result.type = "active";

    result.reason = "已有原始来源";

    return result;
  }

  // 有来源、有内容

  if (news.source && news.content && news.content.length > 100) {
    result.type = "repair";

    result.reason = "缺少来源链接，但内容完整";

    return result;
  }

  // 内容不足

  result.type = "archived";

  result.reason = "缺少来源链接且内容不足";

  return result;
}

async function main() {
  console.log("开始历史新闻质量检测...");

  const newsList = await prisma.news.findMany({
    select: {
      id: true,

      title: true,

      source: true,

      sourceUrl: true,

      content: true,
    },
  });

  console.log(`新闻总量:${newsList.length}`);

  let active = 0;

  let repair = 0;

  let archived = 0;

  for (const news of newsList) {
    const result = checkNews(news);

    if (result.type === "active") {
      active++;
    }

    if (result.type === "repair") {
      repair++;
    }

    if (result.type === "archived") {
      archived++;
    }
  }

  console.log(
    `

====================

检测完成

====================


正常新闻:
${active}


待修复来源:
${repair}


建议归档:
${archived}


====================

`,
  );
}

main()
  .catch((error) => {
    console.error(error);
  })

  .finally(async () => {
    await prisma.$disconnect();
  });
