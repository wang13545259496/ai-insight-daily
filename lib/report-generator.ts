import { prisma } from "@/lib/prisma";

export async function generateDailyReport() {
  const date = new Date().toISOString().split("T")[0];

  // 防止同一天重复生成日报
  const existingReport = await prisma.dailyReport.findFirst({
    where: {
      date,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existingReport) {
    console.log(
      `今日日报已存在，跳过重复生成：${existingReport.title}`
    );

    return existingReport;
  }

  const news = await prisma.news.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 8,
  });

  if (news.length === 0) {
    return null;
  }

  let content = `
AI Insight Daily

${date}

今日AI热点：

`;

  news.forEach((item, index) => {
    content += `

${index + 1}.
${item.title}

摘要：
${item.summary}

来源：
${item.source}

`;
  });

  content += `

行业趋势：

人工智能技术持续快速发展，
大模型、多模态、智能体等方向成为关注重点。


创业机会：

围绕AI应用、自动化工具、
企业智能化服务等方向存在新的机会。

`;

  const report = await prisma.dailyReport.create({
    data: {
      title: `AI Insight Daily ${date}`,
      content,
      date,
    },
  });

  console.log(
    `日报生成完成：${report.title}`
  );

  return report;
}
