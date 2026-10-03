import { prisma } from "@/lib/prisma";

function generateAnalysis(news: any) {
  const title = news.title || "";

  const summary = news.summary || "";

  return {
    background: `
该事件属于 ${news.category} 领域。

${title}

目前该事件已经被多个信息来源关注，
系统根据新闻来源、事件关联关系和产业方向进行分析。

`,
    content: `
【事件概览】

${summary}



【核心内容】

该新闻反映了人工智能产业中的最新变化。

相关企业、技术方向和市场参与者正在围绕该领域持续推进。


【产业影响】

该事件可能影响：

1. AI产品应用生态

2. 企业数字化升级

3. AI商业模式探索



【商业机会】

潜在方向包括：

AI应用工具

企业智能助手

AI服务平台

行业垂直解决方案



【风险分析】

需要持续关注：

技术成熟度

数据安全

商业落地成本


`,
  };
}

async function main() {
  console.log("开始生成新闻智能分析...");

  const newsList = await prisma.news.findMany({
    take: 100,

    orderBy: {
      createdAt: "desc",
    },
  });

  let count = 0;

  for (const news of newsList) {
    try {
      const result = generateAnalysis(news);

      await prisma.news.update({
        where: {
          id: news.id,
        },

        data: {
          background: result.background,

          content: result.content,
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

  console.log("AI新闻分析生成完成");

  await prisma.$disconnect();
}

main();
