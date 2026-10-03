import { prisma } from "@/lib/prisma";

const categories = [
  {
    name: "大模型",
    keywords: ["gpt", "gemini", "claude", "llm", "大模型", "模型"],
  },

  {
    name: "AI Agent",
    keywords: ["agent", "智能体", "workflow"],
  },

  {
    name: "AI应用",
    keywords: ["application", "enterprise", "企业", "应用", "saas"],
  },

  {
    name: "AI安全",
    keywords: ["security", "安全", "cyber"],
  },

  {
    name: "机器人",
    keywords: ["robot", "机器人"],
  },

  {
    name: "AI芯片",
    keywords: ["gpu", "chip", "芯片"],
  },
];

export async function getCategoryHeat() {
  const news = await prisma.news.findMany({
    select: {
      title: true,

      summary: true,

      content: true,
    },

    take: 5000,
  });

  const result = categories.map((category) => {
    let count = 0;

    news.forEach((item) => {
      const text = (item.title + item.summary + item.content).toLowerCase();

      const matched = category.keywords.some((keyword) =>
        text.includes(keyword.toLowerCase()),
      );

      if (matched) {
        count++;
      }
    });

    return {
      name: category.name,

      value: count,
    };
  });

  return result

    .filter((item) => item.value > 0)

    .sort((a, b) => b.value - a.value)

    .slice(0, 10);
}
