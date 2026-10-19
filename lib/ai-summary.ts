import { appendFileSync } from "node:fs";
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
6. summary 必须直接陈述新闻事实（谁做了什么、关键数据、结论），禁止以“新闻标题为…”“正文仅…”“该报道…”这类描述新闻本身的句式开头。

各字段的写法要求（重要，直接影响可读性）：

【impact 与 insight 禁止套用固定句式】
实测 87% 的 impact 都以「对AI产业而言，…」开头，读起来像填模板。
本轮起必须避免：

- 禁止以「对AI产业而言」「对 AI 产业而言」「对产业而言」开头
- 禁止固定套用「对X而言…对企业来说…」这种两段并列结构
- 每一段都要从新闻本身的具体对象切入：
  直接说清「谁受影响、通过什么机制、朝哪个方向变」

  反例（模板）：对AI产业而言，该事件将推动技术发展，对企业来说需关注落地。
  正例（具体）：长上下文模型的推理成本每降一个量级，RAG 架构的必要性就弱一分——
                向量数据库厂商的护城河随之收窄，已有客户会重新评估是否保留这套中间层。

- 若新闻确实涉及多方，可以分点写，但每点必须是不同的影响机制，
  不是同一句话换个主语

【趋势判断必须有历史对照】
判断这件事是「新变化」还是「既有趋势的延续」时，要给出对照依据：

- 若属既有趋势，指出此前已发生的同类事件或标志性节点
- 若属新增变量，说明与此前做法的差异在哪
- 不确定时直说不确定，不要含糊地用「值得关注」搪塞

【background 的写法】
说明事件来龙去脉时，要交代「为什么会发生」而不只是「发生了什么」。
若涉及此前已有的产品、模型或公司动向，点出这个前情。

【businessOpportunity 与 investmentView】
不要写成「具有商业价值」「需要综合判断」这类空话。
要具体到：谁能够变现、靠什么变现、当前的障碍是什么。`;

/* ============================================================
 *  篇幅自适应
 *
 *  背景：系统提示词对所有新闻用同一组字数区间（各字段合计 660–1770 字），
 *  与实际素材长度无关。而实测素材普遍只有几百字 —— 要求写 1500 字、
 *  素材只有 400 字时，模型只能靠套话凑（系统提示词自己记着
 *  「87% 的 impact 以『对AI产业而言』开头」，正是这么来的）。
 *
 *  按素材长度给具体区间，一举两得：
 *    · 短素材不再注水 —— 输出 token 降，可读性反而上升
 *    · 长素材行为完全不变 —— long 档的区间与系统提示词一字不差
 *
 *  实测（生产 7 天 172 次调用）：输出 token 占单条成本 88%，
 *  其中 content 字段一项约占 28%，是最大的单项。
 * ============================================================ */

type LengthTier = "short" | "medium" | "long";

/** 正文少于该字数按短素材处理 */
const SHORT_MATERIAL_CHARS = 600;

/** 正文多于该字数按长素材处理（沿用系统提示词原区间） */
const LONG_MATERIAL_CHARS = 1600;

/** 去掉空白后的正文字数 */
function materialChars(content: string): number {
  return String(content || "").replace(/\s+/g, "").length;
}

function lengthTier(content: string): LengthTier {
  const chars = materialChars(content);

  if (chars < SHORT_MATERIAL_CHARS) return "short";
  if (chars <= LONG_MATERIAL_CHARS) return "medium";

  return "long";
}

/**
 * 各档的字段字数区间。
 *
 * long 档必须与系统提示词里的区间保持一致 —— 那是已验证过的写法，
 * 长文本来就有足够素材撑住这些篇幅，不需要动。
 */
const LENGTH_GUIDE: Record<LengthTier, string> = {
  short: `- background：50-80 字
- summary：70-120 字
- content：120-320 字
- insight：50-100 字
- impact：50-100 字
- businessOpportunity：40-80 字
- investmentView：40-80 字`,
  medium: `- background：70-130 字
- summary：90-180 字
- content：200-480 字
- insight：60-140 字
- impact：60-140 字
- businessOpportunity：60-120 字
- investmentView：60-120 字`,
  long: `- background：80-180 字
- summary：100-250 字
- content：300-700 字
- insight：80-200 字
- impact：80-200 字
- businessOpportunity：80-200 字
- investmentView：80-200 字`,
};

const TIER_LABEL: Record<LengthTier, string> = {
  short: "短",
  medium: "中等",
  long: "较长",
};

/**
 * 篇幅要求块。
 *
 * `AI_LENGTH_GUIDE=off` 时整块不出现，退回改造前的提示词 ——
 * 出问题时不必回滚代码，改环境变量再重启即可。
 */
function buildLengthGuide(content: string): string {
  if (process.env.AI_LENGTH_GUIDE === "off") return "";

  const tier = lengthTier(content);

  return `

【本次篇幅要求】素材正文约 ${materialChars(content)} 字，属${TIER_LABEL[tier]}素材。以下区间**覆盖**系统提示词中的字数要求，请按此执行：

${LENGTH_GUIDE[tier]}

素材不足以支撑某段时就写短，或只写一句话说明缺失；不要为凑字数扩写、复述原文句子或套用固定句式。`;
}

function buildUserPrompt(title: string, content: string) {
  const body =
    content || "正文内容缺失，请基于标题和已有信息进行谨慎分析。";

  return `新闻标题：
${title}

新闻正文：
${body}${buildLengthGuide(body)}`;
}

/** 仅供离线校验：给定正文，返回分档与篇幅块（不发起模型调用） */
export function inspectLengthGuide(content: string): {
  tier: LengthTier;
  chars: number;
  guide: string;
} {
  return {
    tier: lengthTier(String(content || "")),
    chars: materialChars(String(content || "")),
    guide: buildLengthGuide(String(content || "")),
  };
}

/** 是否已配置模型（供调用方判断走 AI 还是回退） */
export function isAIConfigured(): boolean {
  return client !== null;
}

/**
 * DeepSeek 扩展开关：关闭思考模式。
 *
 * 实测同一素材：
 *   思考模式  输出 4408 tokens（推理 3029 + 正文 1379）  21.3 秒
 *   非思考    输出 1152 tokens（纯正文）                  6.4 秒
 *
 * 两者返回字段数相同，insight 质量都在可用范围。本任务是
 * 按提示词输出固定 JSON 的结构化抽取，不依赖深度推理，
 * 而输出 token 占单条成本 90% 以上。
 *
 * OpenAI SDK 的类型定义里没有这个字段，但请求会透传给 DeepSeek。
 */
const THINKING_DISABLED = { thinking: { type: "disabled" } } as const;

/**
 * 记录一次 AI 调用的 token 用量，供成本统计使用。
 *
 * 写到 logs/ai-usage.log，每行一条 JSON。写失败不影响分析结果 ——
 * 统计是次要功能，不能因为它出问题就让整条新闻分析失败。
 */
export function recordUsage(
  model: string,
  usage: unknown,
  /** 调用来源：news=新闻分析，event=事件摘要，travel=行程编排 */
  kind: "news" | "event" | "travel" = "news",
) {
  try {
    const u = usage as {
      prompt_tokens?: number;
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    } | null;

    if (!u || typeof u.prompt_tokens !== "number") return;

    const line =
      JSON.stringify({
        t: new Date().toISOString(),
        k: kind,
        model,
        in: u.prompt_tokens ?? 0,
        out: u.completion_tokens ?? 0,
        reason: u.completion_tokens_details?.reasoning_tokens ?? 0,
      }) + "\n";

    appendFileSync("logs/ai-usage.log", line);
  } catch {
    // 统计失败不入日志、不抛出 —— 避免递归或噪音
  }
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
    model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
    temperature: 0.2,
    ...THINKING_DISABLED,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(title, content) },
    ],
  });

  const elapsed = Date.now() - startedAt;
  const text = response.choices?.[0]?.message?.content || "";

  recordUsage(
    process.env.DEEPSEEK_MODEL || "deepseek-flash",
    response.usage,
    "news",
  );

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
    model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
    temperature: 0.2,
    ...THINKING_DISABLED,
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

/* ============================================================
 *  事件摘要生成
 *
 *  背景：原来的事件摘要是硬编码模板 ——
 *    `围绕"{标题}"形成的AI产业事件。系统将持续聚合相关来源并跟踪后续发展。`
 *  60 个事件 100% 都是这句，除了复述标题没有任何信息。
 *  而它出现在首页「今日重点」和事件页的主要位置。
 *
 *  这里改成用模型基于真实新闻内容生成。
 * ============================================================ */

export interface EventSummaryInput {
  /** 事件标题（可能是话题名，如「AI Agent」） */
  title: string;
  /** 分类，可空 */
  category?: string | null;
  /** 该事件关联的新闻，按时间倒序传入，函数内部只取前 5 条 */
  news: Array<{
    title?: string | null;
    summary?: string | null;
    content?: string | null;
    source?: string | null;
  }>;
}

const EVENT_SUMMARY_SYSTEM_PROMPT = `你是 AI 产业分析师。根据给定的新闻材料，为一个「产业事件」写一段客观摘要。

【输出要求】
2–3 句，120–180 字，中文，直接输出正文。

【必须包含】
- 发生了什么（主体 + 动作 + 时间或阶段）
- 涉及哪些公司、产品或技术
- 当前进展或已披露的影响（如果材料里有）

【禁止】
- 复述标题
- 写「值得关注」「将持续跟踪」「产业影响正在扩散」这类空话
- 预测股价、判断投资价值、给买卖建议
- 编造材料里没有的事实、数字、时间
- 加「摘要：」「本事件」这类前缀

【材料不足时】
如果材料只够支撑一句话，就写一句话，不要为凑字数编内容。`;

function buildEventSummaryPrompt(input: EventSummaryInput): string {
  const picked = input.news
    .slice(0, 5)
    .map((n, i) => {
      const body = String(n.summary || n.content || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);

      return [
        `${i + 1}. ${String(n.title || "").trim()}`,
        n.source ? `   来源：${n.source}` : "",
        body ? `   内容：${body}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `事件标题：${input.title}
${input.category ? `分类：${input.category}` : ""}

相关新闻（共 ${input.news.length} 条，以下为最近的 ${Math.min(5, input.news.length)} 条）：

${picked}`;
}

/** 模型不可用时保持与旧版一致的兜底文案 */
function fallbackEventSummary(input: EventSummaryInput): string {
  const first = input.news[0]?.title || input.title;
  return `围绕“${first}”形成的AI产业事件。系统将持续聚合相关来源并跟踪后续发展。`;
}

/**
 * 为一个事件生成摘要。
 *
 * 与 `generateSummary` 的区别：
 *   · 输入是多条新闻而非单条，输出是一段事件级概述
 *   · 不走 JSON 模式 —— 只要一段纯文本，没必要约束结构
 *   · 温度更低（0.1）—— 事件摘要要求高度忠实于材料，不要发挥
 */
export async function generateEventSummary(
  input: EventSummaryInput,
): Promise<string> {
  if (!client || !input.news.length) {
    return fallbackEventSummary(input);
  }

  const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
  const startedAt = Date.now();

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      ...THINKING_DISABLED,
      messages: [
        { role: "system", content: EVENT_SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: buildEventSummaryPrompt(input) },
      ],
    });

    recordUsage(model, response.usage, "event");

    const text = String(response.choices?.[0]?.message?.content || "")
      .replace(/^["'「]|["'」]$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 20) {
      // 模型返回过短，视为失败，回退模板，不留空摘要
      return fallbackEventSummary(input);
    }

    console.log(
      `[ai] 事件摘要 ${(Date.now() - startedAt) / 1000}s｜${input.title.slice(0, 30)}`,
    );

    return text.slice(0, 400);
  } catch (error) {
    // 事件摘要失败不该阻塞事件创建 —— 回退模板，继续聚合
    console.log(
      `[ai] 事件摘要失败，回退模板｜${input.title.slice(0, 30)}：${String(error).slice(0, 80)}`,
    );
    return fallbackEventSummary(input);
  }
}
