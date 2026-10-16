import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY;

/**
 * DeepSeek 接入层（新闻分析）。
 *
 * ============================================================
 * 超时与重试（2026-10 故障后补上）
 * ============================================================
 *
 * 背景：OpenAI SDK 默认超时为 **10 分钟**、默认自动重试 2 次。
 * 2026-10 DeepSeek 发生持续数小时的故障，症状是「请求挂起、无 HTTP 状态码」
 * （官方状态页确认为服务部分中断）。在那种情况下：
 *
 *   单条新闻分析最坏耗时 = 10 分钟 × (1 + 2 次重试) = 30 分钟
 *
 * 而一次流水线要分析 30 条，整批会被拖住数小时，期间计数器持续累积。
 * 因此把超时收紧到 30 秒——实测正常单条最长约 7 秒（输入 3000 token、
 * 输出 1000 token），30 秒留了 4 倍余量，既不会误杀正常请求，
 * 又能让故障期的坏请求快速失败。
 *
 * maxRetries 保留 2：网络抖动或偶发 5xx 时自动重试，避免单条新闻漏分析。
 * 最坏单条耗时因此为 30s × 3 = 90 秒，仍在可接受范围。
 */
const REQUEST_TIMEOUT_MS = 30_000;

const client = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 2,
    })
  : null;

export interface AIAnalysisResult {
  /** 中文标题。中文来源沿用原标题；英文来源由模型翻译 */
  titleZh: string;
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
    // 回退路径不做翻译。宁可显示英文原标题，
    // 也不要凭空造一个可能失真的中文标题。
    titleZh: title,
    background: `该新闻围绕“${title}”展开，属于人工智能产业近期动态。`,
    summary: text
      ? text.slice(0, 280)
      : `${title}是当前AI产业值得关注的行业动态。`,
    content: text || title,
    insight: "建议持续关注该事件后续技术进展、产品落地和产业影响。",
    impact: "该事件对AI产业的具体影响需要结合技术进展、应用场景和市场反馈进一步判断。",
    businessOpportunity: "该事件潜在商业价值需要结合产品落地、用户需求和产业链变化进一步评估。",
    investmentView: "该事件的投资价值需要结合产业竞争格局、企业优势和长期商业化能力综合判断。",
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
      summary: text.trim().slice(0, 180) || fallback.summary,
      content: text.trim() || fallback.content,
    };
  }

  return {
    // titleZh 缺失时回退到原标题。这保证了两种情况都不会出现空标题：
    //   · 模型未按新提示词返回该字段（旧调用方、模型偶发遗漏）
    //   · 标题本就是中文，模型可能原样返回也可能不返回
    titleZh: String(parsed.titleZh || title),
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

/** 系统提示词：流式与非流式共用 */
const SYSTEM_PROMPT = `你是 AI Insight Daily 的专业AI产业研究分析师。

你的任务不是简单改写新闻，而是基于新闻标题和正文进行事实导向的产业分析。

必须输出严格JSON，字段：
titleZh：中文标题，20-40字
background：事件背景，80-180字
summary：新闻核心摘要，100-250字
content：整理后的可读新闻正文，150-500字
insight：核心产业洞察，80-200字
impact：对AI产业、企业或技术生态的影响，80-200字
businessOpportunity：可能形成的商业机会，80-200字
investmentView：投资观察，80-200字
aiScore：0-100整数

titleZh 的规则：
1. 原标题已是中文时，原样返回原标题，不要改写。
2. 原标题为英文时，翻译为准确、通顺的中文标题，符合中文科技媒体习惯。
3. 公司名、产品名、模型名保留英文原文，不要音译或意译。
   例如 OpenAI、GPT-6、Claude、Gemini、Llama、Kubernetes 保持原样。
4. 不要添加原标题没有的信息，不要用「震惊」「重磅」等夸张词。
5. 不要输出「标题：」之类前缀，直接给标题本身。

重要要求：
1. 不得虚构新闻中不存在的事实、公司、数字、时间或人物。
2. 新闻信息不足时，请用自然语言说明缺失信息或待验证部分，避免反复使用“信息有限”“仍需关注”等固定模板词。
3. businessOpportunity和investmentView必须基于新闻内容推断，不得把推测写成事实。
4. aiScore综合考虑事件重要性、产业影响、信息完整度、商业价值和可信度。
5. 只输出JSON，不要Markdown。
6. summary 必须直接陈述新闻事实（谁做了什么、关键数据、结论），禁止以“新闻标题为…”“正文仅…”“该报道…”这类描述新闻本身的句式开头。`;

function buildUserPrompt(title: string, content: string) {
  return `新闻标题：
${title}

新闻正文：
${content || "正文内容缺失，请基于标题和已有信息进行谨慎分析。"}`;
}

/** 是否已配置模型（供调用方判断走 AI 还是回退） */
export function isAIConfigured(): boolean {
  return client !== null;
}

export async function generateSummary(
  title: string,
  content: string
): Promise<AIAnalysisResult> {
  if (!client) {
    return fallbackAnalysis(title, content);
  }

  const startedAt = Date.now();

  const response = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(title, content) },
    ],
  });

  const elapsed = Date.now() - startedAt;
  const text = response.choices?.[0]?.message?.content || "";

  // 显式计时替代原来的 console.time：并发调用时 console.time 会互相覆盖
  console.log(`[ai] 分析完成 ${(elapsed / 1000).toFixed(1)}s｜${String(title).slice(0, 34)}`);

  return parseAIResponse(text, title, content);
}

/**
 * 流式生成摘要。
 *
 * 用途：**交互式**场景（用户点开某条新闻、实时看到分析逐字出现）。
 *
 * 批量入库**不应**使用本函数——入库必须等完整 JSON 才能解析，
 * 流式对批处理没有加速作用（总耗时不变，只是分多次接收）。
 * 这一点容易被误解，故在此写明。
 *
 * @param onDelta 每收到一段文本时回调，用于实时展示
 */
export async function generateSummaryStream(
  title: string,
  content: string,
  onDelta: (chunk: string, accumulated: string) => void,
): Promise<AIAnalysisResult> {
  if (!client) {
    const fallback = fallbackAnalysis(title, content);

    onDelta(fallback.summary, fallback.summary);

    return fallback;
  }

  const stream = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    temperature: 0.2,
    stream: true,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(title, content) },
    ],
  });

  let accumulated = "";

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || "";

    if (!delta) continue;

    accumulated += delta;
    onDelta(delta, accumulated);
  }

  return parseAIResponse(accumulated, title, content);
}
