import { prisma } from "../lib/prisma";

const industries = [
  {
    name: "AI智能体 Agent",
    category: "Agent",
    keywords: ["Agent", "智能体", "AI员工", "自动化", "工作流"],
    companies: ["OpenAI", "Anthropic", "Microsoft"],
  },

  {
    name: "AI大模型",
    category: "Model",
    keywords: ["GPT", "Claude", "Gemini", "LLM", "大模型"],
    companies: ["OpenAI", "Google", "Anthropic"],
  },

  {
    name: "AI芯片",
    category: "Hardware",
    keywords: ["NVIDIA", "英伟达", "GPU", "CUDA", "HBM", "昇腾", "算力"],
    companies: ["NVIDIA", "华为"],
  },

  {
    name: "AI机器人",
    category: "Robot",
    keywords: ["机器人", "具身智能", "Humanoid", "宇树", "Figure"],
    companies: ["Tesla"],
  },

  {
    name: "AI应用",
    category: "Application",
    keywords: ["SaaS", "Copilot", "AI助手", "客服", "企业AI"],
    companies: ["Microsoft"],
  },
];

async function main() {
  for (const item of industries) {
    let newsCount = 0;

    let recentNewsCount = 0;

    let companyScore = 0;

    for (const keyword of item.keywords) {
      newsCount += await prisma.news.count({
        where: {
          OR: [
            {
              title: {
                contains: keyword,
              },
            },
            {
              summary: {
                contains: keyword,
              },
            },
          ],
        },
      });

      recentNewsCount += await prisma.news.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },

          OR: [
            {
              title: {
                contains: keyword,
              },
            },
            {
              summary: {
                contains: keyword,
              },
            },
          ],
        },
      });
    }

    for (const company of item.companies) {
      const count = await prisma.news.count({
        where: {
          OR: [
            {
              title: {
                contains: company,
              },
            },

            {
              summary: {
                contains: company,
              },
            },
          ],
        },
      });

      if (count > 0) {
        companyScore += 10;
      }
    }

    const score = Math.min(
      100,
      Math.floor(newsCount * 0.04 + recentNewsCount * 0.25 + companyScore),
    );

    const trend = recentNewsCount > 20 ? "up" : "stable";

    const eventCount = await prisma.newsEvent
      .count({
        where: {
          keywords: {
            contains: item.name.split(" ")[0],
          },
        },
      })
      .catch(() => 0);

    await prisma.industryHotspot.upsert({
      where: {
        name: item.name,
      },

      update: {
        score,

        newsCount,

        recentNewsCount,

        eventCount,

        companyScore,

        trend,
      },

      create: {
        name: item.name,

        category: item.category,

        keywords: item.keywords.join(","),

        score,

        newsCount,

        recentNewsCount,

        eventCount,

        companyScore,

        trend,

        description: `${item.name}产业热点分析`,
      },
    });

    console.log(
      item.name,

      "指数:",
      score,

      "新闻:",
      newsCount,

      "7天:",
      recentNewsCount,

      "事件:",
      eventCount,
    );
  }
}

main();
