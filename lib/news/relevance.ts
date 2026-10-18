/**
 * AI 相关性判定（规则版）
 *
 * ## 为什么用规则而不是模型
 *
 * 过滤的目标是**省钱** —— 把无关内容挡在 AI 分析之前。
 * 如果用模型判定，每条新闻都要先花一次调用费才能决定要不要花
 * 第二次，等于没省。
 *
 * 规则版的代价是可能误杀（新闻确实讲 AI 但没用常见词）。
 * 所以词表刻意做宽：命中**任意一个**信号就通过。
 * 宁可放过，不可错杀 —— 放过的成本是 ¥0.004，错杀的代价是漏掉一条真新闻。
 *
 * ## 为什么分四类信号
 *
 * 只用一个「AI」词表会漏掉两种情况：
 *   · 标题只提公司名（"Anthropic 完成新一轮融资"）——
 *     技术词一个都没有，但显然相关
 *   · 标题只提模型名（"GPT-5 发布"）
 * 所以把公司名、产品/模型名、技术术语、中文厂商名分开列，
 * 任一命中即通过。
 *
 * ## 验证方式
 *
 * `scripts/checkRelevance.ts` 可对现有数据库跑一遍，输出通过率
 * 和被拦下的样本，人工确认没有误杀后才启用。
 */

export interface RelevanceResult {
  related: boolean;
  /** 命中的信号词，便于排查误判 */
  matched: string[];
}

/**
 * 通用 AI 技术词。
 *
 * 注意 `模型` 单独出现时歧义大（经济模型、商业模式），
 * 因此只收「大模型 / 语言模型 / 基础模型 / 多模态模型」这类组合词。
 */
const TECH_TERMS = [
  // 「模型」单独收：第一版只收「大模型/语言模型/基础模型」，
  // 结果漏掉了「开源权重模型」「Hybrid-Model Decoding」这类真 AI 新闻。
  // 代价是「数据模型」「经济模型」这类会被误判为相关 ——
  // 在 AI 资讯源里这种词极少，宁可放过。
  "模型",
  "人工智能", "大模型", "大语言模型", "语言模型", "基础模型", "多模态",
  "机器学习", "深度学习", "神经网络", "强化学习", "监督学习",
  "智能体", "生成式", "具身智能",
  // 「机器人」同理：第一版漏了，导致「中国机器人羽毛球」被误杀
  "机器人",
  "算力", "推理", "微调", "预训练", "训练数据", "提示词",
  "算法模型", "计算机视觉", "语音识别", "图像生成", "文本生成",
  "AI", "AGI", "AIGC", "LLM", "GPU", "TPU", "NPU", "RAG",
  "Agent", "Prompt", "Embedding", "Transformer", "Diffusion",
];

/** 海外 AI 公司与机构 */
const INT_ORGANS = [
  "OpenAI", "Anthropic", "DeepMind", "Hugging Face", "Scale AI",
  "Cohere", "Perplexity", "Mistral", "Stability AI", "Midjourney",
  "Runway", "Character.AI", "Pinecone", "Weights & Biases",
  "NVIDIA", "Google AI", "Meta AI", "Microsoft AI", "Apple Intelligence",
  // 「Meta」单独收：第一版只收「Meta AI」，导致
  // 「Meta 发布 Muse Spark Open」被误杀。
  // 词边界会排除 metadata / Metaverse，不会误伤。
  "Meta",
];

/** 模型 / 产品名 */
const MODEL_NAMES = [
  "GPT", "ChatGPT", "Claude", "Gemini", "Gemma", "Llama", "Grok",
  "Qwen", "DeepSeek", "Kimi", "GLM", "ERNIE", "Sora", "Copilot",
  "Nemotron", "Phi-", "Mistral", "Stable Diffusion", "Flux",
  "OpenAI o1", "o3", "DALL·E", "DALL-E", "Whisper", "Codex",
];

/** 中文厂商与其模型 */
const CN_VENDORS = [
  "智谱", "月之暗面", "Moonshot", "MiniMax", "阶跃星辰", "StepFun",
  "通义", "千问", "文心", "一言", "豆包", "混元", "盘古",
  "商汤", "旷视", "依图", "云从", "科大讯飞", "讯飞星火",
  "百川", "零一万物", "书生", "悟道", "紫东太初",
];

const ALL_SIGNALS: Array<{ label: string; terms: string[] }> = [
  { label: "技术词", terms: TECH_TERMS },
  { label: "海外公司", terms: INT_ORGANS },
  { label: "模型产品", terms: MODEL_NAMES },
  { label: "中文厂商", terms: CN_VENDORS },
];

/** 把词编译成一次性的正则，避免每条新闻重复构造 */
const COMPILED: Array<{ label: string; re: RegExp }> = ALL_SIGNALS.map(
  ({ label, terms }) => ({
    label,
    // 英文词加词边界，避免 AI 命中 "said"、GPU 命中 "GPUs" 之外的无意义片段
    re: new RegExp(
      terms
        .map((t) => {
          const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return /^[A-Za-z0-9 &·.-]+$/.test(t)
            ? `(?<![A-Za-z])${escaped}(?![A-Za-z])`
            : escaped;
        })
        .join("|"),
      "i",
    ),
  }),
);

/**
 * 内容天然属于 AI、不需要关键词判定的来源。
 *
 * ## 为什么需要这份名单
 *
 * 对现有 1799 条新闻跑词表验证时发现：arXiv cs.AI / cs.CL 被拦了 10 条，
 * 全是**误杀** —— 论文标题高度专业化（「Whose Data, Whose Benchmark?
 * A User-Centric Framework for Auditing Evaluation」），
 * 一个通用 AI 词汇都没有，但显然是 AI 论文。
 *
 * 同理，AI 实验室的官方博客（OpenAI / Anthropic / DeepMind / NVIDIA…）
 * 发的内容天然相关，用词表去筛只会减少召回。
 *
 * ## 为什么不干脆全部豁免
 *
 * 泛科技源（OSChina、MIT Technology Review、InfoQ、TechCrunch AI）
 * 的拦截率是 13%–68%，那些确实不是 AI 新闻（C# 控件库发布、
 * 猪肾冷冻复活、社交媒体的社会影响）。这些必须过滤。
 */
const AI_ONLY_SOURCES = new Set([
  // 学术
  "arXiv cs.AI",
  "arXiv cs.CL",
  // AI 实验室官方
  "OpenAI 官方博客",
  "Anthropic News",
  "Google DeepMind",
  "Google AI Blog",
  "Meta AI",
  "NVIDIA AI Blog",
  "BAIR Blog",
  "The Gradient",
  "字节 Seed 博客",
  "DeepSeek 文档动态",
  "通义 Qwen 博客",
  // AI 媒体 / 博主
  "量子位",
  "Simon Willison",
]);

/**
 * 判断一条内容是否与 AI 产业相关。
 *
 * @param title      标题（必传，权重最高）
 * @param text       正文或摘要（可为空）
 * @param sourceName 来源名。命中 AI_ONLY_SOURCES 时直接放行
 */
export function checkAiRelevance(
  title: string,
  text?: string | null,
  sourceName?: string | null,
): RelevanceResult {
  const src = String(sourceName || "").trim();

  if (src && AI_ONLY_SOURCES.has(src)) {
    return { related: true, matched: [`来源豁免:${src}`] };
  }

  const haystack = `${title || ""} ${text || ""}`.replace(/\s+/g, " ");

  if (!haystack.trim()) {
    return { related: false, matched: [] };
  }

  const matched: string[] = [];

  for (const { label, re } of COMPILED) {
    const m = haystack.match(re);
    if (m) matched.push(`${label}:${m[0]}`);
  }

  return { related: matched.length > 0, matched };
}
