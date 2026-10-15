/**
 * 事件产业价值分。
 *
 * 背景：首页「今日重点」此前直接按 `heatScore` 排序，而 heatScore 只看
 * 「新闻条数 × 新近度 × aiScore」，没有任何产业属性判断。结果是
 * arXiv 论文、开源项目更新、技术教程这类内容因数量多、更新频繁而挤占首页。
 *
 * 现在改为按**产业价值分**排序：
 *
 *   产业价值分 = 热度 + 企业权重 + 商业价值 + 投资价值 − 学术噪声
 *
 * 各项取值依据实测数据设计（2026-10，18 个 active 事件）：
 *
 *   - 热度：保留完整 heatScore 权重（其内部已含新闻量、新近度、aiScore，
 *     不再重复计算新近度，避免重复计分）
 *   - 企业权重：官方来源占比（质量）> 事件内提及企业数（广度）> 标题提及（低权重）
 *     标题提及只给小权重，否则「某品牌联名活动」这类内容会靠一个企业名蹭高分
 *   - 商业价值：产品发布、开源、合作、定价等产业动作信号
 *   - 投资价值：融资、收购、估值、IPO 等资本动作信号
 *   - 学术噪声：按 arXiv 来源占比扣分（来源标签精确，零误判）
 *
 * 三组候选权重在真实数据上跑出的 TOP6 完全一致，因此选择中间方案（均衡），
 * 对未来数据波动的适应性最好。
 */

/** 头部企业清单：这些企业的动态具有行业指向性 */
export const TOP_COMPANIES = [
  "OpenAI",
  "Google",
  "DeepMind",
  "Anthropic",
  "Microsoft",
  "微软",
  "Meta",
  "NVIDIA",
  "英伟达",
  "DeepSeek",
  "百度",
  "腾讯",
  "阿里",
  "华为",
  "字节",
  "豆包",
  "智谱",
  "MiniMax",
  "月之暗面",
  "Kimi",
  "通义",
  "Qwen",
  "混元",
  "阶跃",
];

/**
 * 企业名歧义排除。
 *
 * 实测踩过的坑：一篇论文标题含「meta-reinforcement learning」，
 * 其中 meta 被当成企业 Meta，使该论文拿到 57 分的企业权重而进入前十。
 * 因此对这些易混词做模式排除。
 */
const COMPANY_EXCLUSIONS: Record<string, RegExp[]> = {
  Meta: [
    /meta[- ]?(learning|reinforcement|analysis|data|heuristic|prompt)/i,
    /metadata/i,
    /metaverse/i,
    /meta[- ]?evaluation/i,
  ],
  Google: [/googlescholar/i],
  Kimi: [/kimi\s*no\s*na\s*wa/i],
};

/** 商业价值信号：产品与产业动作 */
const INDUSTRY_SIGNALS = [
  "发布",
  "上线",
  "推出",
  "开源",
  "合作",
  "接入",
  "部署",
  "商用",
  "定价",
  "launch",
  "release",
  "announce",
  "partner",
  "deploy",
  "pricing",
  "模型",
  "大模型",
  "agent",
  "智能体",
  "芯片",
  "算力",
  "gpu",
];

/** 投资价值信号：资本动作 */
const INVEST_SIGNALS = [
  "融资",
  "投资",
  "估值",
  "收购",
  "并购",
  "上市",
  "ipo",
  "领投",
  "入股",
  "亿元",
  "亿美元",
  "funding",
  "raise",
  "acquisition",
];

/** 学术语言信号（作为 arXiv 来源判断的补充） */
const ACADEMIC_SIGNALS = [
  "we propose",
  "we present",
  "our method",
  "ablation",
  "empirical study",
  "novel approach",
  "state-of-the-art",
  "我们提出",
  "本文提出",
  "实验表明",
  "消融",
];

/** 官方/权威来源特征 */
const OFFICIAL_SOURCE_RE =
  /OpenAI|Google|DeepMind|Anthropic|Microsoft|Meta|NVIDIA|字节 Seed|DeepSeek|Qwen|通义/i;

/** 学术来源特征（按来源判断，精确无歧义） */
const ACADEMIC_SOURCE_RE = /arxiv/i;

/** 权重配置（均衡方案） */
export const INDUSTRY_WEIGHTS = {
  /** 热度权重：乘 heatScore（其上限 1000，实际多在 20-400） */
  heat: 0.6,
  /** 官方来源占比最高贡献 */
  officialRatio: 45,
  /** 事件内提及企业数，每个得分 */
  newsCompany: 8,
  /** 事件内企业数上限 */
  newsCompanyCap: 25,
  /** 标题提及企业，每个得分（低权重，防蹭分） */
  titleCompany: 8,
  /** 标题企业数上限 */
  titleCompanyCap: 12,
  /** 每个商业信号得分与上限 */
  industry: 6,
  industryCap: 35,
  /** 每个投资信号得分与上限 */
  invest: 10,
  investCap: 40,
  /** arXiv 占比扣分系数 */
  academicRatio: 95,
  /** 学术语言占比扣分系数 */
  academicKeyword: 40,
  /** 进入候选的最低产业分 */
  minScore: 60,
};

/** 参与计算的一条新闻所需字段 */
export interface IndustryNewsInput {
  title: string;
  source: string;
}

/** 计算结果，含拆解项便于排查与展示 */
export interface IndustryScoreResult {
  score: number;
  heatPart: number;
  companyPart: number;
  industryPart: number;
  investPart: number;
  academicPenalty: number;
  /** 标题中提及的企业 */
  titleCompanies: string[];
  /** 事件内新闻提及的企业数 */
  newsCompanyCount: number;
  /** 官方来源占比 */
  officialRatio: number;
  /** arXiv 来源占比 */
  academicRatio: number;
  /** 商业 / 投资信号命中数 */
  industryHits: number;
  investHits: number;
  /** 是否具备实质产业信号（单篇事件据此判定合格性） */
  hasSubstance: boolean;
  /** 是否合格进入候选 */
  eligible: boolean;
  /** 不合格原因 */
  reason: string;
}

/** 从文本中提取企业名，带词边界与歧义排除 */
export function companiesIn(text: string): string[] {
  const raw = String(text || "");
  const found: string[] = [];

  for (const company of TOP_COMPANIES) {
    // 拉丁企业名要求词边界，避免 Meta 命中 metadata；
    // 中文名无词边界概念，直接包含即可
    const isLatin = /^[A-Za-z]+$/.test(company);

    const matched = isLatin
      ? new RegExp(`\\b${company}\\b`, "i").test(raw)
      : raw.includes(company);

    if (!matched) continue;

    const exclusions = COMPANY_EXCLUSIONS[company] ?? [];

    if (exclusions.some((re) => re.test(raw))) continue;

    found.push(company);
  }

  return found;
}

/** 统计信号命中数 */
function countSignals(text: string, signals: string[]): number {
  const target = String(text || "").toLowerCase();

  return signals.filter((signal) => target.includes(signal.toLowerCase())).length;
}

/**
 * 计算单个事件的产业价值分。
 *
 * @param title 事件标题
 * @param news  事件包含的新闻（至少 title 与 source）
 * @param heatScore 事件当前热度（由 refreshEventScores 算出，含时间维度）
 */
export function calcIndustryScore(
  title: string,
  news: IndustryNewsInput[],
  heatScore: number,
): IndustryScoreResult {
  const w = INDUSTRY_WEIGHTS;

  if (news.length === 0) {
    return {
      score: 0,
      heatPart: 0,
      companyPart: 0,
      industryPart: 0,
      investPart: 0,
      academicPenalty: 0,
      titleCompanies: [],
      newsCompanyCount: 0,
      officialRatio: 0,
      academicRatio: 0,
      industryHits: 0,
      investHits: 0,
      hasSubstance: false,
      eligible: false,
      reason: "无关联新闻",
    };
  }

  // ---------- 热度 ----------
  const heatPart = heatScore * w.heat;

  // ---------- 企业权重 ----------
  const titleCompanies = companiesIn(title);

  const newsCompanies = new Set<string>();

  for (const item of news) {
    for (const company of companiesIn(item.title)) {
      newsCompanies.add(company);
    }
  }

  const officialRatio =
    news.filter((item) => OFFICIAL_SOURCE_RE.test(item.source)).length / news.length;

  const companyPart =
    Math.min(w.officialRatio, officialRatio * w.officialRatio) +
    Math.min(w.newsCompanyCap, newsCompanies.size * w.newsCompany) +
    Math.min(w.titleCompanyCap, titleCompanies.length * w.titleCompany);

  // ---------- 商业价值 / 投资价值 ----------
  const allText = title + " " + news.map((item) => item.title).join(" ");

  const industryHits = countSignals(allText, INDUSTRY_SIGNALS);
  const investHits = countSignals(allText, INVEST_SIGNALS);

  const industryPart = Math.min(w.industryCap, industryHits * w.industry);
  const investPart = Math.min(w.investCap, investHits * w.invest);

  // ---------- 学术噪声 ----------
  const academicRatio =
    news.filter((item) => ACADEMIC_SOURCE_RE.test(item.source)).length / news.length;

  const academicKeywordRatio =
    news.filter((item) => countSignals(item.title, ACADEMIC_SIGNALS) > 0).length / news.length;

  const academicPenalty =
    academicRatio * w.academicRatio + academicKeywordRatio * w.academicKeyword;

  const score = heatPart + companyPart + industryPart + investPart - academicPenalty;

  // ---------- 合格性判定 ----------
  // 单篇文章撑起的「事件」需要具备实质产业信号才进入首页焦点，
  // 否则单篇技术随笔、产品更新会占据焦点位。
  //
  // 认定为实质信号的任一条件：
  //   1. 命中投资信号（融资/收购/估值），本身就是产业事件
  //   2. 命中 2 个以上商业信号（发布/开源/合作…）
  //   3. 事件内新闻提及 2 家以上企业（跨企业动态）
  //   4. 标题提及企业 **且** 至少 1 个商业信号——覆盖「Meta 发布新模型」
  //      这类单篇企业动态；单独的企业名不算，避免「品牌联名活动」蒙混
  const hasSubstance =
    investHits > 0 ||
    industryHits >= 2 ||
    newsCompanies.size >= 2 ||
    (titleCompanies.length > 0 && industryHits >= 1);

  let eligible = true;
  let reason = "";

  if (academicRatio >= 0.5) {
    eligible = false;
    reason = "学术来源占比过高";
  } else if (news.length === 1 && !hasSubstance) {
    eligible = false;
    reason = "单篇且无产业信号";
  } else if (score < w.minScore) {
    eligible = false;
    reason = "产业分不足";
  }

  return {
    score: Number(score.toFixed(2)),
    heatPart: Number(heatPart.toFixed(2)),
    companyPart: Number(companyPart.toFixed(2)),
    industryPart,
    investPart,
    academicPenalty: Number(academicPenalty.toFixed(2)),
    titleCompanies,
    newsCompanyCount: newsCompanies.size,
    officialRatio: Number(officialRatio.toFixed(4)),
    academicRatio: Number(academicRatio.toFixed(4)),
    industryHits,
    investHits,
    hasSubstance,
    eligible,
    reason,
  };
}
