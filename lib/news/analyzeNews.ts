import { prisma } from "@/lib/prisma";

interface AnalyzeInput {
  newsId: number;
}

export async function analyzeNews({ newsId }: AnalyzeInput) {
  const news = await prisma.news.findUnique({
    where: {
      id: newsId,
    },
  });

  if (!news) {
    return null;
  }

  /*
    
    当前阶段：
    
    使用规则分析模型
    
    后续 V7.4.8.10.5.5.9.3
    接入真实AI模型API
    
    */

  const text = (news.title + news.summary + news.content).toLowerCase();

  let score = 50;

  if (
    text.includes("openai") ||
    text.includes("gpt") ||
    text.includes("chatgpt")
  ) {
    score += 15;
  }

  if (text.includes("agent") || text.includes("智能体")) {
    score += 15;
  }

  if (
    text.includes("business") ||
    text.includes("enterprise") ||
    text.includes("企业")
  ) {
    score += 10;
  }

  if (score > 100) {
    score = 100;
  }

  const insight = `
${news.title}

显示AI产业正在发生新的变化。

该事件可能影响AI技术发展方向、
商业应用模式以及产业竞争格局。
`;

  const impact = `
行业影响：

1. 推动AI技术应用进一步扩大。

2. 加速企业采用AI解决方案。

3. 促进AI生态上下游发展。
`;

  const businessOpportunity = `
商业机会：

1. AI应用服务。

2. 企业智能化升级。

3. AI工具与Agent生态建设。
`;

  const investmentView = `
投资观察：

重点关注AI基础模型、
企业AI应用、
智能体生态等方向的发展变化。
`;

  const result = await prisma.news.update({
    where: {
      id: newsId,
    },

    data: {
      insight,

      impact,

      businessOpportunity,

      investmentView,

      aiScore: score,

      analysisStatus: "completed",
    },
  });

  return result;
}
