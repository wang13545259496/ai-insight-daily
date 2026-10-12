import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY;

const client = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    })
  : null;

export interface AIAnalysisResult {
  background: string;
  summary: string;
  content: string;
  insight: string;
  impact: string;
  businessOpportunity: string;
  investmentView: string;
  aiScore: number;
}

function fallbackAnalysis(title: string, content: string): AIAnalysisResult {
  const text = String(content || "").replace(/\s+/g, " ").trim();

  return {
    background: `该新闻围绕“${title}”展开，属于人工智能产业近期动态。`,
    summary: text
      ? text.slice(0, 280)
      : `${title}是当前AI产业值得关注的行业动态。`,
    content: text || title,
    insight: "建议持续关注该事件后续技术进展、产品落地和产业影响。",
    impact: "该事件可能影响相关技术路线、企业竞争格局及AI应用生态。",
    businessOpportunity: "重点观察企业服务、AI应用、Agent及相关基础设施的商业化机会。",
    investmentView: "建议关注事件对相关产业链企业的收入增长、技术壁垒和市场竞争的实际影响。",
    aiScore: 50,
  };
}

function normalizeScore(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseAIResponse(text: string, title: string, content: string) {
  let parsed: any = null;

  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = null;
      }
    }
  }

  if (!parsed) {
    const fallback = fallbackAnalysis(title, content);

    return {
      ...fallback,
      summary: text.trim().slice(0, 500) || fallback.summary,
      content: text.trim() || fallback.content,
    };
  }

  return {
    background: String(parsed.background || ""),
    summary: String(parsed.summary || ""),
    content: String(parsed.content || content || title),
    insight: String(parsed.insight || ""),
    impact: String(parsed.impact || ""),
    businessOpportunity: String(parsed.businessOpportunity || ""),
    investmentView: String(parsed.investmentView || ""),
    aiScore: normalizeScore(parsed.aiScore),
  };
}

export async function generateSummary(
  title: string,
  content: string
): Promise<AIAnalysisResult> {
  if (!client) {
    return fallbackAnalysis(title, content);
  }

  const response = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `你是 AI Insight Daily 的专业AI产业研究分析师。

你的任务不是简单改写新闻，而是基于新闻标题和正文进行事实导向的产业分析。

必须输出严格JSON，字段：
background：事件背景，80-180字
summary：新闻核心摘要，100-250字
content：整理后的可读新闻正文，150-500字
insight：核心产业洞察，80-200字
impact：对AI产业、企业或技术生态的影响，80-200字
businessOpportunity：可能形成的商业机会，80-200字
investmentView：投资观察，80-200字
aiScore：0-100整数

重要要求：
1. 不得虚构新闻中不存在的事实、公司、数字、时间或人物。
2. 新闻信息不足时明确使用“信息有限”“仍需关注后续确认”等表述。
3. businessOpportunity和investmentView必须基于新闻内容推断，不得把推测写成事实。
4. aiScore综合考虑事件重要性、产业影响、信息完整度、商业价值和可信度。
5. 只输出JSON，不要Markdown。`,
      },
      {
        role: "user",
        content: `新闻标题：
${title}

新闻正文：
${content || "正文信息有限，请基于标题谨慎分析。"}`
      },
    ],
  });

  const text = response.choices?.[0]?.message?.content || "";

  return parseAIResponse(text, title, content);
}
