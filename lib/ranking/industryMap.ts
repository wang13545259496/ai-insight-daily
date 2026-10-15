/**
 * 产业链地图：把新闻归类到 AI 产业的各个层级。
 *
 * 设计依据（2026-10 实测，近 30 天 437 条新闻）：
 *
 *   基础模型      196 条  44.9%
 *   Agent/应用     98 条  22.4%
 *   芯片/算力      33 条   7.6%
 *   具身智能       23 条   5.3%
 *   云/基础设施    14 条   3.2%
 *
 * 分类建立在**新闻层**而非事件层。实测按事件映射产业层会完全失效：
 * 事件标题是公司名（如「OpenAI生态」）而非产业类型，按关键词匹配
 * 到产业层时「芯片/算力」「云/基础设施」两层的事件数为 0。
 *
 * 分层原则：
 *   - 每条新闻只归入**一个**主层级（按命中权重取最高），避免重复计数
 *   - 层级关键词按「专指性」排序，专指词权重高于通用词
 *     例：nvidia 权重高于 gpu，因为提到 nvidia 基本可确定是芯片话题
 *   - 无法归入任何层级的新闻标记为「其它」，不计入分层统计
 */

/**
 * AI 相关性判定。
 *
 * 全库新闻里混有大量与 AI 无关的内容（实测 145/437 条无法归入任何
 * 产业层），主要来自综合科技源：
 *   OSChina  → 开发者工具版本发布（Jync、UJCMS、novel-plus CMS）
 *   TechCrunch → 创业公司综合报道（音乐标识、麦克风硬件）
 *   MIT Tech Review → 生物医药、军事科技
 *
 * 产业链地图只应展示 AI 产业内容，因此在分层前先做相关性判定。
 * 判定不追求完备（宁可多留），只剔除明显无关的条目——
 * 漏判的代价是该条不显示，误判的代价是噪声进入地图，后者更糟。
 */
const AI_SIGNALS = [
  "ai",
  "人工智能",
  "智能",
  "大模型",
  "模型",
  "llm",
  "gpt",
  "agent",
  "智能体",
  "算力",
  "推理",
  "训练",
  "inference",
  "neural",
  "machine learning",
  "机器学习",
  "深度学习",
  "deep learning",
  "transformer",
  "openai",
  "anthropic",
  "deepseek",
  "claude",
  "gemini",
  "llama",
  "qwen",
  "通义",
  "智谱",
  "kimi",
  "豆包",
  "混元",
  "文心",
  "nvidia",
  "英伟达",
  "gpu",
  "tpu",
  "机器人",
  "robot",
  "具身",
];

/**
 * 判断一条新闻是否属于 AI 产业内容。
 *
 * @param title   新闻标题
 * @param content 新闻正文（可为空）
 */
export function isAINews(title: string, content = ""): boolean {
  const titleText = String(title || "").toLowerCase();
  const bodyText = String(content || "").toLowerCase().slice(0, 800);

  // 标题命中即算（标题是主题陈述）
  if (AI_SIGNALS.some((kw) => matchesKeyword(titleText, kw))) return true;

  // 正文需要两个以上信号，避免顺带提及
  const hits = AI_SIGNALS.filter((kw) => matchesKeyword(bodyText, kw)).length;

  return hits >= 2;
}

/** 学术来源：这些源的内容已由产业价值分过滤，不进入产业链地图 */
const ACADEMIC_SOURCE_PATTERN = /arxiv|biorxiv|medrxiv|papers|proceedings/i;

/** 判断是否为学术来源的新闻 */
export function isAcademicSource(source: string): boolean {
  return ACADEMIC_SOURCE_PATTERN.test(String(source || ""));
}

/** 产业层级定义 */
export interface IndustryLayer {
  /** 层级显示名 */
  name: string;
  /** 一句话说明该层在产业链中的位置 */
  description: string;
  /**
   * 识别关键词及权重。
   * 权重越高表示该词对层级的专指性越强：
   *   3 = 公司/产品专名（提到基本可确定层级）
   *   2 = 技术专有名词
   *   1 = 通用词（可能跨层级，给低权重）
   */
  keywords: Array<[string, number]>;
}

/**
 * 五个产业层，按产业链自上而下排列。
 *
 * 层级顺序即展示顺序：算力底座 → 云平台 → 模型 → 应用 → 具身终端。
 */
export const INDUSTRY_LAYERS: IndustryLayer[] = [
  {
    name: "芯片与算力",
    description: "GPU、加速芯片、数据中心等算力基础设施",
    keywords: [
      ["nvidia", 3],
      ["英伟达", 3],
      ["amd", 3],
      ["intel", 3],
      ["tsmc", 3],
      ["台积电", 3],
      ["寒武纪", 3],
      ["昇腾", 3],
      ["ascend", 3],
      ["cerebras", 3],
      ["groq", 3],
      ["h100", 3],
      ["h200", 3],
      ["b200", 3],
      ["gb200", 3],
      ["tpu", 2],
      ["gpu", 2],
      ["算力", 2],
      ["芯片", 2],
      ["数据中心", 2],
      ["datacenter", 2],
      ["compute cluster", 2],
      ["制程", 2],
      ["晶圆", 2],
      // 「算力」在「苹果市值」类财经新闻里会被误命中，靠 minScore 阈值过滤
    ],
  },
  {
    name: "云与基础设施",
    description: "云厂商、模型部署平台、推理服务",
    keywords: [
      ["aws", 3],
      ["azure", 3],
      ["google cloud", 3],
      ["阿里云", 3],
      ["腾讯云", 3],
      ["华为云", 3],
      ["火山引擎", 3],
      ["volcengine", 3],
      ["cloudflare", 3],
      ["coreweave", 3],
      ["lambda labs", 3],
      ["together ai", 3],
      ["fireworks ai", 3],
      ["replicate", 3],
      ["sagemaker", 3],
      ["vertex ai", 3],
      ["bedrock", 3],
      ["推理服务", 2],
      ["模型部署", 2],
    ],
  },
  {
    name: "基础模型",
    description: "大模型研发、训练、开源与能力竞争",
    keywords: [
      ["openai", 3],
      ["anthropic", 3],
      ["deepmind", 3],
      ["deepseek", 3],
      ["mistral", 3],
      ["cohere", 3],
      ["xai", 3],
      ["moonshot", 3],
      ["月之暗面", 3],
      ["minimax", 3],
      ["智谱", 3],
      ["glm", 3],
      ["通义", 3],
      ["qwen", 3],
      ["文心", 3],
      ["ernie", 3],
      ["混元", 3],
      ["hunyuan", 3],
      ["豆包", 3],
      ["doubao", 3],
      ["阶跃", 3],
      ["step-", 3],
      ["kimi", 3],
      ["gemini", 3],
      ["claude", 2],
      ["llama", 3],
      ["gpt-", 3],
      ["gpt5", 3],
      ["gpt6", 3],
      ["大模型", 2],
      ["基础模型", 2],
      ["foundation model", 2],
      ["预训练", 2],
      ["fine-tun", 2],
      ["微调", 2],
      ["moe", 2],
      ["混合专家", 2],
      ["多模态", 2],
      ["长上下文", 2],
      ["context window", 2],
      ["开源权重", 2],
      ["模型权重", 2],
      ["benchmark", 1],
      ["基准测试", 1],
    ],
  },
  {
    name: "Agent 与应用",
    description: "智能体、AI 编程、企业应用与消费级产品",
    keywords: [
      ["cursor", 3],
      ["copilot", 3],
      ["perplexity", 3],
      ["manus", 3],
      ["harvey", 3],
      ["glean", 3],
      ["sierra", 3],
      ["character.ai", 3],
      ["replit", 3],
      ["lovable", 3],
      ["windsurf", 3],
      ["智能体", 3],
      ["agent", 3],
      ["ai agent", 3],
      ["agentic", 3],
      ["claude code", 3],
      ["codex", 3],
      ["ai 编程", 2],
      ["ai coding", 2],
      ["代码生成", 2],
      ["编程助手", 2],
      ["coding assistant", 2],
      ["工作流", 1],
      ["workflow", 1],
      ["客服", 1],
      ["助手", 1],
      ["assistant", 1],
      ["saas", 1],
      ["企业应用", 1],
    ],
  },
  {
    name: "具身智能",
    description: "人形机器人、自动驾驶与物理世界交互",
    keywords: [
      ["figure", 3],
      ["unitree", 3],
      ["宇树", 3],
      ["智元", 3],
      ["星尘智能", 3],
      ["agility robotics", 3],
      ["boston dynamics", 3],
      ["1x technolog", 3],
      ["waymo", 3],
      ["cruise", 3],
      ["特斯拉 fsd", 3],
      ["具身", 3],
      ["人形机器人", 3],
      ["humanoid", 3],
      ["机器人", 2],
      ["robot", 2],
      ["自动驾驶", 2],
      ["autonomous driving", 2],
      ["机械臂", 2],
    ],
  },
];

/**
 * 资本动态信号词。
 *
 * 用于从新闻中挑出「资本事件」，独立于产业分层展示。
 * 实测标题含明确融资信号的仅 9 条（近 30 天），因此这一维度
 * 只做简版列举，不做统计图表——数据量不足以支撑聚合分析。
 */
export const CAPITAL_SIGNALS: Array<[string, number]> = [
  ["融资", 3],
  ["估值", 3],
  ["领投", 3],
  ["跟投", 3],
  ["轮融资", 3],
  ["ipo", 3],
  ["上市", 2],
  ["收购", 3],
  ["并购", 3],
  ["募资", 3],
  ["funding", 3],
  ["raises $", 3],
  ["raised $", 3],
  ["valuation", 3],
  ["acquire", 2],
  ["acquisition", 2],
  ["investment", 1],
  ["investor", 1],
];

/** 单条新闻的分类结果 */
export interface LayerAssignment {
  /** 命中的层级名；未命中任何层级时为 null */
  layer: string | null;
  /** 该层级的命中得分，用于判断置信度 */
  score: number;
  /** 命中的关键词（便于调试与展示） */
  matchedKeywords: string[];
}

/**
 * 关键词匹配。
 *
 * 拉丁词必须按词边界匹配，否则会大量误命中：
 *   实测踩过的坑 ——「intel」命中了「intelligence」与「Intelligence」，
 *   使「Flox Intelligence is building AI to keep wildlife away…」被归入
 *   芯片与算力（intel 在标题，权重 3×3=9）。
 *   同类风险：meta（metadata/metaverse）、amd、core 等。
 *
 * 中文词没有词边界概念，退回 includes 判断。
 * 含连字符或空格的词（如 gpt-、h100、claude code）用 \b 时边界仍然正确，
 * 但为避免转义问题，这里对非纯 ASCII 词直接 includes。
 */
function matchesKeyword(haystack: string, keyword: string): boolean {
  const kw = keyword.toLowerCase();

  // 纯 ASCII 字母数字词 → 词边界匹配
  if (/^[a-z0-9][a-z0-9 ._-]*$/.test(kw)) {
    // 转义正则元字符（如 gpt- 里的连字符本身安全，但 . 需要转义）
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // 边界判定：前后不能紧邻字母或数字，避免 intelligence 命中 intel
    return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(haystack);
  }

  // 含中文或其它字符 → 直接包含匹配
  return haystack.includes(kw);
}

/**
 * 归入某层所需的最低得分。
 *
 * 实测踩过的坑（阈值 4 时仍误判）：
 *   「刚刚，苹果正式迈入5万亿美元时代」正文含「算力」等词 → 混入芯片与算力
 *   「智能不出彩的『领克』，刚靠一次坠崖事故出圈了」→ 混入芯片与算力
 *   「Apate sends AI agents undercover…」→ Agent 新闻被归入芯片与算力
 *
 * 这些条目的共同点是：只在正文里顺带提及若干通用词，标题并未陈述
 * 该层主题。阈值提高到 9 后，相当于要求「标题命中一个权重 3 的专名词」
 * （3×3=9），或「正文命中三个专名词」，能滤掉这类边缘命中。
 */
const MIN_LAYER_SCORE = 6;

/**
 * 把一条新闻归入产业层级。
 *
 * 归属规则：累加所有命中关键词的权重，取得分最高的层级；
 * 同分时按 INDUSTRY_LAYERS 的定义顺序（即产业链自上而下）取靠前者，
 * 保证结果稳定可复现。得分低于 MIN_LAYER_SCORE 时判为无法归类。
 *
 * @param title   新闻标题
 * @param content 新闻正文（可为空）
 */
export function classifyLayer(title: string, content = ""): LayerAssignment {
  // 标题权重高于正文：标题是该条新闻的主题陈述，正文可能只是顺带提及
  const titleText = String(title || "").toLowerCase();
  const bodyText = String(content || "").toLowerCase();

  let best: LayerAssignment = { layer: null, score: 0, matchedKeywords: [] };

  for (const layer of INDUSTRY_LAYERS) {
    let score = 0;
    const matched: string[] = [];

    for (const [keyword, weight] of layer.keywords) {
      let hit = false;

      if (matchesKeyword(titleText, keyword)) {
        score += weight * 3; // 标题命中：3 倍权重
        hit = true;
      } else if (matchesKeyword(bodyText, keyword)) {
        score += weight;
        hit = true;
      }

      if (hit) matched.push(keyword);
    }

    // 严格大于才替换：同分时保留先定义的层级（产业链上层优先）
    if (score > best.score) {
      best = { layer: layer.name, score, matchedKeywords: matched };
    }
  }

  // 得分过低视为无法归类，避免单一弱命中把无关内容带进地图
  if (best.score < MIN_LAYER_SCORE) {
    return { layer: null, score: best.score, matchedKeywords: best.matchedKeywords };
  }

  return best;
}

/** 是否可以视为资本动态 */
export function isCapitalNews(title: string, content = ""): boolean {
  const titleText = String(title || "").toLowerCase();
  const bodyText = String(content || "").toLowerCase().slice(0, 800);

  return CAPITAL_SIGNALS.some(
    ([kw]) => matchesKeyword(titleText, kw) || matchesKeyword(bodyText, kw),
  );
}

/** 一条新闻进入地图前的完整评估 */
export interface MapEligibility {
  /** 是否纳入地图 */
  eligible: boolean;
  /** 不纳入的原因 */
  reason: string | null;
  /** 归入的层级 */
  layer: string | null;
}

/**
 * 判断一条新闻能否进入产业链地图，并给出层级。
 *
 * 三层过滤（顺序即优先级）：
 *   1. 学术来源 → 排除（arXiv 等已由产业价值分过滤，不属于产业地图）
 *   2. 非 AI 内容 → 排除（综合科技源的开发者工具、生物医药等）
 *   3. 无法归入任何层级 → 排除
 *
 * 这是地图数据的唯一入口，保证口径一致。
 */
export function evaluateForMap(
  title: string,
  content: string,
  source: string,
): MapEligibility {
  if (isAcademicSource(source)) {
    return { eligible: false, reason: "学术来源", layer: null };
  }

  if (!isAINews(title, content)) {
    return { eligible: false, reason: "非 AI 内容", layer: null };
  }

  const assignment = classifyLayer(title, content);

  if (!assignment.layer) {
    return { eligible: false, reason: "无法归入产业层", layer: null };
  }

  return { eligible: true, reason: null, layer: assignment.layer };
}

/** 产业链地图的统计数据 */
export interface LayerStats {
  name: string;
  description: string;
  /** 该层新闻数 */
  count: number;
  /** 占全部已归类新闻的比例（0-1） */
  ratio: number;
  /** 代表性新闻标题（最多 3 条） */
  samples: string[];
}

/**
 * 统计各层新闻分布。
 *
 * @param news 已归类的新闻列表（每条含 title / content / layer）
 */
export function summarizeLayers(
  news: Array<{ title: string; content?: string; layer: string | null }>,
): { layers: LayerStats[]; classified: number; unclassified: number } {
  const classified = news.filter((n) => n.layer !== null).length;
  const unclassified = news.length - classified;

  const layers = INDUSTRY_LAYERS.map((layer) => {
    const matched = news.filter((n) => n.layer === layer.name);

    return {
      name: layer.name,
      description: layer.description,
      count: matched.length,
      ratio: classified > 0 ? matched.length / classified : 0,
      samples: matched.slice(0, 3).map((n) => String(n.title).slice(0, 60)),
    };
  });

  return { layers, classified, unclassified };
}
