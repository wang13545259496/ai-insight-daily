import { prisma } from "@/lib/prisma";

export async function generateDailyBriefing() {
  const events = await prisma.newsEvent.findMany({
    include: {
      news: {
        select: {
          id: true,
        },
      },
    },
  });

  if (events.length === 0) {
    return null;
  }

  const rankedEvents = events

    .map((event) => {
      const newsCount = event.news.length;

      const score =
        Number(event.heatScore ?? 0) * 0.45 +
        Number(event.peakScore ?? 0) * 0.25 +
        Number(event.qualityScore ?? 0) * 0.2 +
        Math.log(newsCount + 1) * 10;

      return {
        ...event,

        newsCount,

        score,
      };
    })

    .sort((a, b) => b.score - a.score)

    .slice(0, 10);

  const topEvents = rankedEvents

    .map((event, index) => {
      return `

━━━━━━━━━━━━━━━━━━

TOP ${index + 1}


${event.title}



【事件背景】

${event.summary}



【所属领域】

${event.category}



【关注原因】

该事件当前受到AI行业持续关注。


综合指标：

当前热度：
${event.heatScore}


历史峰值：
${event.peakScore}


相关新闻：
${event.newsCount}篇



【趋势分析】

${event.trendSummary || "该事件仍处于持续发展阶段。"}



【发展状态】

${event.trendStatus}



`;
    })

    .join("\n");

  const trendEvents = rankedEvents

    .slice(0, 5)

    .map((event, index) => {
      return `

${index + 1}. ${event.title}

领域：
${event.category}

趋势：
${event.trendStatus}


`;
    })

    .join("\n");

  const hotChange = `

📈 今日AI趋势观察


${trendEvents}


系统综合：

- AI事件热度变化
- 新闻增长情况
- 多源信息数量
- 事件趋势状态


生成今日行业趋势分析。

`;
  const opportunities = await prisma.businessOpportunity.findMany({
    take: 5,

    orderBy: {
      createdAt: "desc",
    },
  });

  const businessText =
    opportunities.length > 0
      ? opportunities

          .map((item, index) => {
            return `

${index + 1}. ${item.opportunity}


方向：

${item.direction}


行业：

${item.industry}


`;
          })

          .join("\n")
      : "暂无新增商业机会数据。";

  const businessOpportunity = `

🚀 AI商业机会观察


${businessText}


以上机会来自AI新闻事件、行业趋势以及商业机会数据库综合分析。


`;

  const summary = `

📊 今日AI行业总结


今日重点关注事件：

${rankedEvents[0]?.title || ""}



今日最高热度：

${rankedEvents[0]?.heatScore || 0}



事件分析链路：


RSS新闻采集

↓

新闻验证

↓

事件聚类

↓

热度分析

↓

趋势判断

↓

AI每日简报生成



`;

  const today = new Date()

    .toISOString()

    .slice(0, 10);

  const content = `


🔥 今日AI十大事件


${topEvents}




📈 今日AI趋势


${hotChange}




🚀 商业机会观察


${businessOpportunity}




📊 行业总结


${summary}



`;

  const report = await prisma.dailyReport.upsert({
    where: {
      date: today,
    },

    update: {
      title: "AI每日事件简报",

      content,
    },

    create: {
      title: "AI每日事件简报",

      date: today,

      content,
    },
  });

  return report;
}
