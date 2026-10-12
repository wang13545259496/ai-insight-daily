import { prisma } from "@/lib/prisma";
import { getHotNews } from "@/lib/news/getHotNews";

export async function generateDailyReport() {
  const hotNews = await getHotNews(10);

  const hotEvents = await prisma.newsEvent.findMany({
    where: {
      status: "active",
    },
    orderBy: {
      heatScore: "desc",
    },
    take: 8,
    include: {
      news: {
        select: {
          id: true,
        },
      },
    },
  });

  const today = new Date()
    .toISOString()
    .split("T")[0];

  let content = `# AI Insight Daily - ${today}

## 🔥 今日AI热点事件

`;

  hotEvents.forEach((event, index) => {
    content += `${index + 1}. ${event.title}

- 当前热度：${event.heatScore}
- 历史峰值：${event.peakScore}
- 趋势：${event.trendStatus}
- 相关新闻：${event.news.length} 条
- 事件分析：${event.summary}
- 趋势判断：${event.trendSummary || "持续观察"}

`;
  });

  content += `## 📰 今日重点新闻

`;

  hotNews.forEach((item, index) => {
    content += `${index + 1}. ${item.title}

来源：${item.source}
AI评分：${item.aiScore}
热点指数：${item.hotScore.finalScore}

摘要：
${item.summary}

产业洞察：
${item.insight || "暂无"}

商业机会：
${item.businessOpportunity || "暂无"}

投资观察：
${item.investmentView || "暂无"}

`;
  });

  content += `## 📈 今日趋势观察

系统基于最近24小时与前24小时的实际新闻数量、AI评分、多源数量和验证状态计算趋势，不使用随机数据。

重点关注：

- 大模型与基础模型能力
- AI Agent与智能体生态
- 企业AI应用落地
- AI基础设施与芯片
- AI商业化与投资机会
`;

  return {
    title: `AI Insight Daily ${today}`,
    content,
    date: today,
  };
}
