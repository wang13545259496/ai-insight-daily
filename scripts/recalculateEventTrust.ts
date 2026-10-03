import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("开始AI事件可信度重新计算...");

  const events = await prisma.newsEvent.findMany({
    include: {
      news: {
        where: {
          dataStatus: "active",
        },
      },
    },
  });

  for (const event of events) {
    const news = event.news;

    let score = 0;

    // 新闻数量

    if (news.length >= 10) {
      score += 30;
    } else if (news.length >= 5) {
      score += 20;
    } else if (news.length > 0) {
      score += 10;
    }

    // 来源完整度

    const urlCount = news.filter((n) => n.sourceUrl).length;

    const urlRate = news.length ? urlCount / news.length : 0;

    score += Math.round(urlRate * 25);

    // 多源验证

    const multi = news.filter((n) => n.sourceCount >= 2).length;

    if (multi >= 5) {
      score += 25;
    } else if (multi > 0) {
      score += 15;
    } else {
      score += 5;
    }

    // 官方来源

    const officialKeywords = [
      "OpenAI",

      "Google",

      "Microsoft",

      "Anthropic",

      "百度",

      "腾讯",
    ];

    const official = news.some((n) =>
      officialKeywords.some((k) => n.source.includes(k)),
    );

    if (official) {
      score += 10;
    }

    // 时间活跃

    const recent = news.some((n) => {
      const days = (Date.now() - new Date(n.createdAt).getTime()) / 86400000;

      return days <= 7;
    });

    if (recent) {
      score += 10;
    }

    let level = "低";

    if (score >= 90) {
      level = "权威";
    } else if (score >= 70) {
      level = "高";
    } else if (score >= 40) {
      level = "中";
    }

    await prisma.newsEvent.update({
      where: {
        id: event.id,
      },

      data: {
        heatScore: score,

        peakScore: score,

        trendSummary: `AI可信度评分:${score}分，等级:${level}`,
      },
    });

    console.log(
      `${event.title}

评分:${score}

等级:${level}`,
    );
  }

  console.log("事件可信度计算完成");
}

main()
  .catch((error) => {
    console.error(error);
  })

  .finally(async () => {
    await prisma.$disconnect();
  });
