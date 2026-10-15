/**
 * AI SCORE 拆解。
 *
 * 背景：现有页面只显示「AI评分 75」这样一个裸数字，用户无法理解它代表什么、
 * 由什么构成。实测 aiScore 分布（1655 条）集中在 65-88 区间：
 *   75 分 515 条（31.1%）｜65 分 248 条｜85 分 211 条｜72 分 153 条
 * 最高 95 分仅 7 条，最低 0 分 69 条（AI 分析失败或回退值）。
 *
 * 本模块把裸分数拆成四个可解释的维度，并给出等级说明：
 *   重要程度 —— 分数本身所处的档位
 *   信息完整度 —— 由正文长度推出（长文包含更多可分析事实）
 *   来源可信度 —— 由来源类型推出（官方源 > 行业媒体 > 个人博客）
 *   商业相关度 —— 由标题/正文中的商业动作信号推出
 *
 * 设计原则：拆解结果是**确定性的**（同样输入必得同样输出），
 * 不引入新的模型调用。AI 只负责给出总分，解释由代码完成——
 * 这与项目「代码算数、AI 只做整理」的一贯做法一致。
 */

/** 等级定义 */
export interface ScoreTier {
  /** 等级名 */
  label: string;
  /** 说明该等级意味着什么 */
  meaning: string;
  /** 该等级对应的最低分 */
  min: number;
}

/**
 * 分数档位。
 *
 * 依据实测分布划分，使各档都有实际内容（避免出现空档）：
 *   0-29   低（69 条 0 分 + 少量低分，多为分析失败或内容单薄）
 *   30-59  一般（约 130 条）
 *   60-69  中等（约 280 条）
 *   70-79  较高（约 820 条，主力区间）
 *   80-100 高（约 290 条）
 */
export const SCORE_TIERS: ScoreTier[] = [
  { min: 80, label: "高", meaning: "产业影响明确，信息充分，值得重点关注" },
  { min: 70, label: "较高", meaning: "有明确产业价值，信息较完整" },
  { min: 60, label: "中等", meaning: "具备一定产业相关性，可作背景参考" },
  { min: 30, label: "一般", meaning: "产业相关性有限，或信息量偏少" },
  { min: 0, label: "低", meaning: "信息不足或与产业关联较弱" },
];

/** 取得分数对应的档位 */
export function getTier(score: number): ScoreTier {
  const s = Number(score) || 0;

  for (const tier of SCORE_TIERS) {
    if (s >= tier.min) return tier;
  }

  return SCORE_TIERS[SCORE_TIERS.length - 1];
}

/** 单个维度的拆解结果 */
export interface ScoreDimension {
  /** 维度名 */
  name: string;
  /** 0-100 的评分 */
  value: number;
  /** 文字说明，解释为何是这个分数 */
  note: string;
}

export interface ScoreBreakdown {
  /** 原始总分 */
  score: number;
  /** 档位 */
  tier: ScoreTier;
  /** 各维度 */
  dimensions: ScoreDimension[];
}

/**
 * 信息完整度：由正文长度推出。
 *
 * 依据：正文越长，可分析的事实越多，AI 给出高分的依据越充分。
 * 实测库内正文长度中位约 330 字，多数条目在 90-800 字之间。
 */
function contentCompleteness(contentLength: number): ScoreDimension {
  let value: number;
  let note: string;

  if (contentLength >= 3000) {
    value = 95;
    note = "全文抓取完整，信息充分";
  } else if (contentLength >= 1000) {
    value = 80;
    note = "正文较长，事实信息较充分";
  } else if (contentLength >= 400) {
    value = 60;
    note = "正文中等，关键信息基本具备";
  } else if (contentLength >= 150) {
    value = 40;
    note = "正文偏短，可能仅有导语";
  } else {
    value = 20;
    note = "正文很短，分析依据有限";
  }

  return { name: "信息完整度", value, note };
}

/**
 * 来源可信度：由来源类型推出。
 *
 * 官方源（企业博客、文档）的表述更准确；
 * 行业媒体有编辑流程；个人博客主观性较强。
 */
function sourceCredibility(source: string): ScoreDimension {
  const s = String(source || "");

  const OFFICIAL = /官方|official|blog|文档|news\.|deepmind|openai|anthropic|microsoft|google/i;
  const MEDIA = /techcrunch|infoq|量子位|oschina|机器之心|36氪|verge|wired|mit technology/i;
  const PERSONAL = /simon willison|个人|hacker news|reddit/i;

  if (PERSONAL.test(s)) {
    return { name: "来源可信度", value: 50, note: "个人渠道，观点性较强，建议交叉验证" };
  }

  if (MEDIA.test(s)) {
    return { name: "来源可信度", value: 75, note: "行业媒体，有编辑流程" };
  }

  if (OFFICIAL.test(s)) {
    return { name: "来源可信度", value: 90, note: "官方来源，表述准确度高" };
  }

  return { name: "来源可信度", value: 65, note: "常规来源" };
}

/** 商业动作信号词 */
const BUSINESS_SIGNALS = [
  "发布",
  "上线",
  "推出",
  "开源",
  "融资",
  "估值",
  "收购",
  "合作",
  "接入",
  "集成",
  "定价",
  "降价",
  "商业化",
  "落地",
  "客户",
  "营收",
  "release",
  "launch",
  "announcing",
  "funding",
  "raises",
  "acquire",
  "partnership",
  "pricing",
  "customer",
];

/**
 * 商业相关度：由标题与正文中的商业动作信号推出。
 *
 * 出现明确的商业动作（发布、融资、合作、定价）时相关度高；
 * 纯技术讨论或观点文章则较低。
 */
function businessRelevance(title: string, content: string): ScoreDimension {
  const text = (String(title || "") + " " + String(content || "").slice(0, 600)).toLowerCase();

  const hits = BUSINESS_SIGNALS.filter((kw) => text.includes(kw.toLowerCase()));

  let value: number;
  let note: string;

  if (hits.length >= 4) {
    value = 90;
    note = `商业动作明确（${hits.slice(0, 3).join("、")}等）`;
  } else if (hits.length >= 2) {
    value = 70;
    note = `含商业动作（${hits.slice(0, 2).join("、")}）`;
  } else if (hits.length === 1) {
    value = 50;
    note = `提及「${hits[0]}」，商业信息有限`;
  } else {
    value = 30;
    note = "以技术讨论或观点为主，无明确商业动作";
  }

  return { name: "商业相关度", value, note };
}

/** 重要程度：直接用总分所处档位 */
function importance(score: number): ScoreDimension {
  const tier = getTier(score);

  return { name: "重要程度", value: Math.round(score), note: tier.meaning };
}

/**
 * 拆解 AI SCORE。
 *
 * @param score   原始分数
 * @param title   新闻标题
 * @param content 新闻正文
 * @param source  来源名
 */
export function breakdownScore(
  score: number,
  title: string,
  content = "",
  source = "",
): ScoreBreakdown {
  const s = Math.max(0, Math.min(100, Number(score) || 0));

  return {
    score: s,
    tier: getTier(s),
    dimensions: [
      importance(s),
      contentCompleteness(String(content || "").length),
      sourceCredibility(source),
      businessRelevance(title, content),
    ],
  };
}
