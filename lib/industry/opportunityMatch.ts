import { prisma } from "@/lib/prisma";

function expandKeywords(text: string) {
  const map: any = {
    智能体: ["agent", "助手", "自动化", "工作流", "智能运营"],

    大模型: ["llm", "模型", "生成式ai", "知识库", "智能问答"],

    内容: ["生成", "营销", "视频", "图片", "创作"],

    客服: ["客户", "服务", "机器人", "问答"],

    教育: ["学习", "培训", "教学"],
  };

  let keywords: string[] = [text.toLowerCase()];

  Object.keys(map).forEach((key) => {
    if (text.includes(key)) {
      keywords.push(...map[key]);
    }
  });

  return keywords;
}

export async function matchIndustryOpportunity(
  hotspotName: string,

  hotspotKeywords?: string,

  category?: string,
) {
  const opportunities = await prisma.businessOpportunity.findMany({
    orderBy: {
      createdAt: "desc",
    },

    take: 100,
  });

  const searchText = [hotspotName, hotspotKeywords || "", category || ""]

    .join(" ")

    .toLowerCase();

  const keywords = expandKeywords(searchText);

  const result = opportunities.filter((item) => {
    const target = [
      item.opportunity,

      item.industry,

      item.direction,

      item.description,

      item.trend,
    ]

      .join(" ")

      .toLowerCase();

    return keywords.some((keyword) => target.includes(keyword));
  });

  return result.slice(0, 5);
}
