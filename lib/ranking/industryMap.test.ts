import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CAPITAL_SIGNALS,
  INDUSTRY_LAYERS,
  classifyLayer,
  evaluateForMap,
  isAINews,
  isAcademicSource,
  isCapitalNews,
  summarizeLayers,
} from "./industryMap";

/**
 * 产业链地图分类器测试。
 *
 * 用例取自真实数据（2026-10 库内新闻标题），覆盖：
 *   - 各层级的典型归属
 *   - 跨层级词冲突（如 agent 与 芯片 同时出现）
 *   - 标题权重高于正文
 *   - 无法归类的边界情况
 */

describe("ranking/industryMap 层级归属", () => {
  it("芯片与算力：识别 GPU 与芯片公司", () => {
    assert.equal(classifyLayer("英伟达发布新一代 B200 芯片").layer, "芯片与算力");
    assert.equal(classifyLayer("NVIDIA data center GPU shipments grow").layer, "芯片与算力");
    assert.equal(classifyLayer("寒武纪发布新一代加速卡").layer, "芯片与算力");
  });

  it("云与基础设施：识别云厂商", () => {
    assert.equal(classifyLayer("阿里云发布新推理服务").layer, "云与基础设施");
    assert.equal(classifyLayer("Cloudflare Workers 支持入站 TCP").layer, "云与基础设施");
    assert.equal(classifyLayer("AWS 推出新的模型部署方案").layer, "云与基础设施");
  });

  it("基础模型：识别模型厂商与模型名", () => {
    assert.equal(classifyLayer("OpenAI 发布 GPT-6").layer, "基础模型");
    assert.equal(classifyLayer("DeepSeek V4 Preview 发布").layer, "基础模型");
    assert.equal(classifyLayer("Anthropic 公开反蒸馏防御战报").layer, "基础模型");
    assert.equal(classifyLayer("智谱发布 GLM-Legal 模型").layer, "基础模型");
  });

  it("Agent 与应用：识别智能体与 AI 编程", () => {
    assert.equal(classifyLayer("Cursor 发布新版 AI 编程工具").layer, "Agent 与应用");
    assert.equal(classifyLayer("企业级智能体落地实践 AgentOps").layer, "Agent 与应用");
  });

  it("具身智能：识别机器人与自动驾驶", () => {
    assert.equal(classifyLayer("宇树发布新一代人形机器人").layer, "具身智能");
    assert.equal(classifyLayer("星尘智能完成新一轮融资").layer, "具身智能");
    assert.equal(classifyLayer("Waymo 扩大自动驾驶运营范围").layer, "具身智能");
  });

  it("标题权重高于正文（标题是主题陈述，正文可能只是顺带提及）", () => {
    // 标题讲 Agent 且含专名，正文顺带提到 OpenAI → 应归 Agent 层
    // 注意：若标题只含「智能体」（权重2×3=6 < 阈值9），会因得分不足判为无法归类，
    // 因此本用例用含专名（Cursor）的标题验证权重机制。
    const r = classifyLayer(
      "Cursor 发布新版编程助手",
      "文中提到该方案基于 OpenAI 模型构建",
    );

    assert.equal(r.layer, "Agent 与应用");
    assert.ok(r.score >= 9);
  });

  it("跨层关键词冲突时取得分高者", () => {
    // 标题同时含「英伟达」（芯片，权重3×3=9）与「agent」（应用，权重2×3=6）
    const r = classifyLayer("英伟达发布 Agent 开发套件");

    // 芯片侧 9 分，应用侧 6 分 → 归芯片
    assert.equal(r.layer, "芯片与算力");
    assert.ok(r.score > 0);
  });

  it("无法归类的新闻返回 null", () => {
    const r = classifyLayer("今天天气不错");

    assert.equal(r.layer, null);
    assert.equal(r.score, 0);
    assert.deepEqual(r.matchedKeywords, []);
  });

  it("拉丁关键词按词边界匹配（实测 intel 命中 intelligence 的坑）", () => {
    // 「Flox Intelligence is building AI to keep wildlife away from trains」
    // 曾因 intel 子串命中 intelligence 而被归入芯片与算力
    const r = classifyLayer(
      "Flox Intelligence is building AI to keep wildlife away from trains, airports, and roads",
    );

    assert.notEqual(r.layer, "芯片与算力");
    assert.equal(r.matchedKeywords.includes("intel"), false);
  });

  it("财经新闻里的 intelligence 不触发芯片归类", () => {
    // 正文出现 intelligence 与人工智能等词，但未真正提及芯片公司
    const r = classifyLayer(
      "刚刚，苹果正式迈入5万亿美元时代",
      "苹果市值增长与人工智能 business intelligence 相关，多家科技公司同样受益。",
    );

    assert.equal(r.matchedKeywords.includes("intel"), false);
    assert.notEqual(r.layer, "芯片与算力");
  });

  it("命中关键词会记录，便于调试", () => {
    const r = classifyLayer("OpenAI 发布新模型");

    assert.equal(r.layer, "基础模型");
    assert.ok(r.matchedKeywords.includes("openai"));
  });

  it("单一弱命中不足以归层（实测误判案例）", () => {
    // 「算力」出现在财经新闻里 → 不应归入芯片与算力
    assert.equal(classifyLayer("刚刚，苹果正式迈入5万亿美元时代").layer, null);
    // 「inference」出现在学术标题里 → 不应归入云与基础设施
    assert.equal(
      classifyLayer("Confluent: constrained Inference-time optimal control").layer,
      null,
    );
  });
});

describe("ranking/industryMap AI 相关性", () => {
  it("识别 AI 相关新闻", () => {
    assert.equal(isAINews("OpenAI 发布新模型"), true);
    assert.equal(isAINews("企业级智能体落地实践"), true);
    assert.equal(isAINews("英伟达发布新芯片"), true);
    assert.equal(isAINews("量子位：大模型推理成本下降"), true);
  });

  it("排除与 AI 无关的内容（实测噪声来源）", () => {
    assert.equal(isAINews("Jync v1.7.3 — 一键升级与版本检查双通道"), false);
    assert.equal(isAINews("UJCMS 13.1.4 发布，页面可视化编辑来了"), false);
    assert.equal(isAINews("novel-plus v5.4.0 发布，原创文学 CMS 系统"), false);
    assert.equal(isAINews("The US military's race to make fake blood"), false);
  });

  it("学术来源判定", () => {
    assert.equal(isAcademicSource("arXiv cs.AI"), true);
    assert.equal(isAcademicSource("arXiv cs.CL"), true);
    assert.equal(isAcademicSource("OpenAI 官方博客"), false);
    assert.equal(isAcademicSource("量子位"), false);
  });

  it("evaluateForMap 三层过滤", () => {
    // 学术来源 → 排除
    assert.equal(
      evaluateForMap("Some paper on LLM", "content", "arXiv cs.AI").reason,
      "学术来源",
    );

    // 非 AI 内容 → 排除
    assert.equal(
      evaluateForMap("UJCMS 13.1.4 发布", "content", "OSChina 资讯").reason,
      "非 AI 内容",
    );

    // AI 但无法归层 → 排除
    assert.equal(
      evaluateForMap("AI 行业观察随笔", "一些泛泛而谈的内容", "某博客").reason,
      "无法归入产业层",
    );

    // 正常 AI 产业新闻 → 纳入
    const good = evaluateForMap("OpenAI 发布 GPT-6", "正文", "OpenAI 官方博客");
    assert.equal(good.eligible, true);
    assert.equal(good.layer, "基础模型");
  });
});

describe("ranking/industryMap 资本动态", () => {
  it("识别融资与并购", () => {
    assert.equal(isCapitalNews("星尘智能完成新一轮融资，估值达150亿元"), true);
    assert.equal(isCapitalNews("Pluto Security raises $42M"), true);
    assert.equal(isCapitalNews("某公司宣布收购另一家公司"), true);
  });

  it("不会把普通新闻误判为资本动态", () => {
    assert.equal(isCapitalNews("OpenAI 发布新模型"), false);
    assert.equal(isCapitalNews("Cloudflare 支持入站 TCP"), false);
  });
});

describe("ranking/industryMap 统计", () => {
  it("summarizeLayers 正确计数与占比", () => {
    const news = [
      { title: "OpenAI 发布 GPT-6", layer: "基础模型" },
      { title: "DeepSeek V4 发布", layer: "基础模型" },
      { title: "英伟达新芯片", layer: "芯片与算力" },
      { title: "今天天气不错", layer: null },
    ];

    const r = summarizeLayers(news);

    assert.equal(r.classified, 3);
    assert.equal(r.unclassified, 1);

    const model = r.layers.find((l) => l.name === "基础模型");
    assert.equal(model?.count, 2);
    assert.ok(Math.abs((model?.ratio ?? 0) - 2 / 3) < 0.001);

    const chip = r.layers.find((l) => l.name === "芯片与算力");
    assert.equal(chip?.count, 1);
  });

  it("层级顺序与定义一致（产业链自上而下）", () => {
    const r = summarizeLayers([{ title: "x", layer: "基础模型" }]);

    assert.deepEqual(
      r.layers.map((l) => l.name),
      INDUSTRY_LAYERS.map((l) => l.name),
    );
  });

  it("空输入不报错", () => {
    const r = summarizeLayers([]);

    assert.equal(r.classified, 0);
    assert.equal(r.layers.every((l) => l.count === 0), true);
  });

  it("配置完整性：每层都有描述与关键词", () => {
    for (const layer of INDUSTRY_LAYERS) {
      assert.ok(layer.name.length > 0);
      assert.ok(layer.description.length > 0);
      assert.ok(layer.keywords.length >= 5, `${layer.name} 关键词过少`);
    }

    assert.ok(CAPITAL_SIGNALS.length >= 8);
  });
});
