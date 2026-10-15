import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INDUSTRY_WEIGHTS,
  calcIndustryScore,
  companiesIn,
} from "./industryScore";

/**
 * 产业价值分测试。
 *
 * 重点覆盖三类真实踩过坑的场景：
 *   1. arXiv 论文不应因产量高而拿高分
 *   2. 企业名子串误判（meta-reinforcement 不是 Meta 公司）
 *   3. 单篇弱事件与聚合事件的可比性
 */

function news(title: string, source: string) {
  return { title, source };
}

describe("ranking/industryScore 企业识别", () => {
  it("识别常见企业名", () => {
    assert.deepEqual(companiesIn("OpenAI 发布新模型"), ["OpenAI"]);
    assert.deepEqual(companiesIn("DeepSeek 完成融资"), ["DeepSeek"]);
    assert.deepEqual(companiesIn("字节 Seed 博客上线"), ["字节"]);
  });

  it("中文企业名可直接包含匹配", () => {
    assert.ok(companiesIn("腾讯混元模型升级").includes("腾讯"));
    assert.ok(companiesIn("华为盘古发布").includes("华为"));
  });

  it("排除 meta 作为前缀的学术词（实测误判案例）", () => {
    // 「meta-reinforcement learning」里的 meta 不是企业 Meta
    assert.deepEqual(companiesIn("Some considerations on learning to explore via meta-reinforcement learning"), []);
    assert.deepEqual(companiesIn("metadata driven pipeline"), []);
    assert.deepEqual(companiesIn("metaverse applications"), []);
  });

  it("正常提及 Meta 公司仍能识别", () => {
    assert.ok(companiesIn("Meta 发布 Muse 新模型").includes("Meta"));
  });

  it("拉丁企业名要求词边界", () => {
    // "Metadata" 含 meta 但词边界不匹配
    assert.equal(companiesIn("MetadataService").includes("Meta"), false);
  });
});

describe("ranking/industryScore 学术噪声", () => {
  it("纯 arXiv 论文因学术噪声被扣分且不合格", () => {
    const result = calcIndustryScore(
      "Rethinking the Roles of Diffusion and Decoding",
      [
        news("Rethinking the Roles of Diffusion and Decoding", "arXiv cs.CL"),
        news("A New Method for Efficient Attention", "arXiv cs.CL"),
      ],
      150,
    );

    assert.equal(result.academicRatio, 1);
    assert.ok(result.academicPenalty > 90, `学术扣分应超过 90，实际 ${result.academicPenalty}`);
    assert.equal(result.eligible, false, "纯学术事件不应合格");
    assert.equal(result.reason, "学术来源占比过高");
  });

  it("arXiv 占比过半时不合格", () => {
    const result = calcIndustryScore(
      "混合事件",
      [
        news("论文一", "arXiv cs.AI"),
        news("论文二", "arXiv cs.AI"),
        news("产业新闻", "TechCrunch AI"),
      ],
      120,
    );

    assert.ok(result.academicRatio > 0.5);
    assert.equal(result.eligible, false);
  });

  it("产业事件含少量 arXiv 内容时仍合格（如 AI Agent 事件）", () => {
    const result = calcIndustryScore(
      "AI Agent",
      [
        news("OpenAI 发布 Agent 工具", "OpenAI 官方博客"),
        news("企业级 Agent 落地实践", "InfoQ 中文"),
        news("Agent 相关论文", "arXiv cs.AI"),
      ],
      350,
    );

    assert.ok(result.academicRatio < 0.5);
    assert.ok(result.academicPenalty > 0, "应扣分但不致不合格");
    assert.equal(result.eligible, true);
  });

  it("学术语言命中也会扣分", () => {
    const withAcademicTone = calcIndustryScore(
      "事件",
      [news("We propose a novel approach for X", "TechCrunch AI")],
      100,
    );

    assert.ok(withAcademicTone.academicPenalty > 0);
  });
});

describe("ranking/industryScore 产业信号", () => {
  it("投融资事件获得投资价值分", () => {
    const result = calcIndustryScore(
      "星尘智能完成新一轮融资，公司估值达150亿元",
      [news("星尘智能完成新一轮融资，公司估值达150亿元", "InfoQ 中文")],
      55,
    );

    assert.ok(result.investPart > 0, "应命中投资信号");
    assert.ok(result.investHits >= 2);
    assert.equal(result.eligible, true, "投融资事件应合格");
  });

  it("产品发布获得商业价值分", () => {
    // 用生产数据实测值：该事件产业分 77、判定为产业相关
    const result = calcIndustryScore(
      "智谱发布 GLM-Legal 模型：基于轻量级底座、基准测试追平闭源",
      [
        news(
          "智谱发布 GLM-Legal 模型：基于轻量级底座、基准测试追平闭源",
          "OSChina 资讯",
        ),
      ],
      82,
    );

    assert.ok(result.industryPart > 0, "应命中商业信号");
    assert.ok(
      result.score >= INDUSTRY_WEIGHTS.minScore,
      `产业分应达阈值，实际 ${result.score}`,
    );
    assert.equal(result.eligible, true);
  });

  it("单篇弱产品发布被判定为不合格", () => {
    // 实测值（scripts/travel/debug-score.ts 验证）：
    // 热度 45×0.6=27 + 商业信号 1 个（发布）×6 = 33 分，低于阈值 60。
    //
    // 注意 reason 是「单篇且无产业信号」而非「产业分不足」——
    // 合格性判定有固定顺序，单篇缺实质信号的情况先命中前者。
    const result = calcIndustryScore(
      "某公司发布新产品",
      [news("某公司发布新产品", "某技术博客")],
      45,
    );

    assert.equal(result.score, 33);
    assert.ok(result.score < INDUSTRY_WEIGHTS.minScore);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "单篇且无产业信号");
  });

  it("官方来源占比提升企业权重", () => {
    const official = calcIndustryScore(
      "OpenAI 生态",
      [
        news("OpenAI 发布 A", "OpenAI 官方博客"),
        news("OpenAI 发布 B", "OpenAI 官方博客"),
      ],
      150,
    );

    const nonOfficial = calcIndustryScore(
      "OpenAI 生态",
      [news("OpenAI 发布 A", "某技术博客"), news("OpenAI 发布 B", "某技术博客")],
      150,
    );

    assert.equal(official.officialRatio, 1);
    assert.equal(nonOfficial.officialRatio, 0);
    assert.ok(
      official.companyPart > nonOfficial.companyPart,
      "官方来源应获得更高企业权重",
    );
  });
});

describe("ranking/industryScore 合格性判定", () => {
  it("单篇且无产业信号的事件不合格", () => {
    const result = calcIndustryScore(
      "Redesigning source control",
      [news("Redesigning source control", "Simon Willison")],
      88,
    );

    assert.equal(result.hasSubstance, false);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "单篇且无产业信号");
  });

  it("单篇但含企业名或产业信号时合格", () => {
    const result = calcIndustryScore(
      "Meta 新模型杀回AI第一梯队",
      [news("Meta 新模型杀回AI第一梯队，亲述翻身内幕", "InfoQ 中文")],
      88,
    );

    assert.equal(result.eligible, true);
  });

  it("多篇事件即使信号弱也可合格", () => {
    const result = calcIndustryScore(
      "大模型竞争",
      [
        news("Gemini 4 Argon 全球上线", "OSChina 资讯"),
        news("某模型发布更新", "量子位"),
      ],
      195,
    );

    assert.equal(result.eligible, true);
  });

  it("无关联新闻时不合格", () => {
    const result = calcIndustryScore("空事件", [], 0);

    assert.equal(result.score, 0);
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "无关联新闻");
  });
});

describe("ranking/industryScore 排序合理性", () => {
  it("聚合产业事件得分高于单篇学术论文", () => {
    const industry = calcIndustryScore(
      "AI Agent",
      [
        news("OpenAI 发布 Agent 平台", "OpenAI 官方博客"),
        news("企业 Agent 部署实践", "InfoQ 中文"),
        news("腾讯发布智能体", "量子位"),
        news("智能体论文", "arXiv cs.AI"),
      ],
      370,
    );

    const paper = calcIndustryScore(
      "Benchmarking Embedding Geometries",
      [news("Benchmarking Embedding Geometries and Clustering", "arXiv cs.AI")],
      190,
    );

    assert.ok(
      industry.score > paper.score,
      `产业事件(${industry.score}) 应高于学术论文(${paper.score})`,
    );
    assert.equal(industry.eligible, true);
    assert.equal(paper.eligible, false);
  });

  it("投融资事件得分高于同热度的技术随笔", () => {
    const funding = calcIndustryScore(
      "DeepSeek 半年融 1500 亿冲向科创板",
      [news("DeepSeek 半年融 1500 亿冲向科创板，估值大涨", "OSChina 资讯")],
      85,
    );

    const essay = calcIndustryScore(
      "Hello Python 3.15, goodbye 3.10",
      [news("Hello Python 3.15, goodbye 3.10", "Simon Willison")],
      85,
    );

    assert.ok(
      funding.score > essay.score,
      `投融资(${funding.score}) 应高于技术随笔(${essay.score})`,
    );
  });

  it("品牌联名活动不会仅凭企业名获得高分", () => {
    // 实测案例：谷歌时尚联名活动因标题含 Google + 官方源 100% 一度排进前六
    const event = calcIndustryScore(
      "Co-creating the future of fashion with Google",
      [news("Co-creating the future of fashion with Google", "Google AI Blog")],
      32,
    );

    // 无产业动作、无投资信号 → 单篇且缺实质信号，不合格
    assert.equal(event.hasSubstance, false);
    assert.equal(event.eligible, false);
  });
});

describe("ranking/industryScore 权重配置", () => {
  it("权重配置在合理范围内", () => {
    assert.ok(INDUSTRY_WEIGHTS.heat > 0 && INDUSTRY_WEIGHTS.heat <= 1.5);
    assert.ok(INDUSTRY_WEIGHTS.minScore > 0 && INDUSTRY_WEIGHTS.minScore < 100);
    assert.ok(INDUSTRY_WEIGHTS.academicRatio >= 50, "学术扣分需足够强才能压住论文");
  });

  it("分数保留两位小数且拆解项自洽", () => {
    const result = calcIndustryScore(
      "OpenAI 发布新模型",
      [news("OpenAI 发布新模型，支持 Agent", "OpenAI 官方博客")],
      200,
    );

    const sum =
      result.heatPart +
      result.companyPart +
      result.industryPart +
      result.investPart -
      result.academicPenalty;

    assert.equal(result.score, Number(sum.toFixed(2)));
  });
});
