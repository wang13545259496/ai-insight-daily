import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SCORE_TIERS,
  breakdownScore,
  getTier,
} from "./scoreBreakdown";

/**
 * AI SCORE 拆解测试。
 *
 * 档位划分依据实测分布（1655 条新闻）：
 *   75 分最多（515 条）、65 分 248 条、85 分 211 条，最高 95 分。
 */

describe("ranking/scoreBreakdown 档位", () => {
  it("按实测分布划分档位", () => {
    assert.equal(getTier(95).label, "高");
    assert.equal(getTier(85).label, "高");
    assert.equal(getTier(80).label, "高");
    assert.equal(getTier(75).label, "较高");
    assert.equal(getTier(70).label, "较高");
    assert.equal(getTier(65).label, "中等");
    assert.equal(getTier(60).label, "中等");
    assert.equal(getTier(45).label, "一般");
    assert.equal(getTier(30).label, "一般");
    assert.equal(getTier(0).label, "低");
  });

  it("边界值归属于较高档（min 为闭区间）", () => {
    assert.equal(getTier(80).min, 80);
    assert.equal(getTier(79).label, "较高");
    assert.equal(getTier(70).min, 70);
  });

  it("异常输入不报错", () => {
    assert.equal(getTier(-10).label, "低");
    assert.equal(getTier(NaN).label, "低");
    assert.equal(getTier(200).label, "高");
  });

  it("档位配置覆盖 0-100 且有序", () => {
    assert.ok(SCORE_TIERS.length >= 4);

    const mins = SCORE_TIERS.map((t) => t.min);

    for (let i = 1; i < mins.length; i++) {
      assert.ok(mins[i] < mins[i - 1], "档位应按 min 降序排列");
    }

    assert.equal(mins[mins.length - 1], 0, "最低档必须从 0 开始");
  });
});

describe("ranking/scoreBreakdown 拆解", () => {
  it("返回四个维度且都有说明", () => {
    const r = breakdownScore(75, "OpenAI 发布新模型", "正文内容".repeat(100), "OpenAI 官方博客");

    assert.equal(r.dimensions.length, 4);

    const names = r.dimensions.map((d) => d.name);
    assert.deepEqual(names, ["重要程度", "信息完整度", "来源可信度", "商业相关度"]);

    for (const d of r.dimensions) {
      assert.ok(d.value >= 0 && d.value <= 100, `${d.name} 超出 0-100`);
      assert.ok(d.note.length > 0, `${d.name} 缺少说明`);
    }
  });

  it("信息完整度随正文长度提升", () => {
    const short = breakdownScore(70, "标题", "短正文", "某源");
    const long = breakdownScore(70, "标题", "长正文".repeat(600), "某源");

    const shortDim = short.dimensions.find((d) => d.name === "信息完整度");
    const longDim = long.dimensions.find((d) => d.name === "信息完整度");

    assert.ok((longDim?.value ?? 0) > (shortDim?.value ?? 0));
  });

  it("来源可信度区分官方源与个人渠道", () => {
    const official = breakdownScore(70, "t", "c", "OpenAI 官方博客");
    const personal = breakdownScore(70, "t", "c", "Simon Willison");

    const o = official.dimensions.find((d) => d.name === "来源可信度");
    const p = personal.dimensions.find((d) => d.name === "来源可信度");

    assert.ok((o?.value ?? 0) > (p?.value ?? 0));
  });

  it("商业相关度识别商业动作", () => {
    const biz = breakdownScore(
      70,
      "某公司完成 3 亿元融资，估值达 50 亿",
      "公司宣布发布新产品并与多家企业合作，同时下调定价。",
      "InfoQ 中文",
    );
    const tech = breakdownScore(70, "深入理解注意力机制的数学原理", "纯技术推导。", "某博客");

    const b = biz.dimensions.find((d) => d.name === "商业相关度");
    const t = tech.dimensions.find((d) => d.name === "商业相关度");

    assert.ok((b?.value ?? 0) > (t?.value ?? 0));
    assert.ok((b?.note ?? "").includes("商业"));
  });

  it("重要程度等于原始分数", () => {
    const r = breakdownScore(75, "t", "c", "s");
    const dim = r.dimensions.find((d) => d.name === "重要程度");

    assert.equal(dim?.value, 75);
  });

  it("分数被限定在 0-100", () => {
    assert.equal(breakdownScore(150, "t", "c", "s").score, 100);
    assert.equal(breakdownScore(-5, "t", "c", "s").score, 0);
    assert.equal(breakdownScore(NaN, "t", "c", "s").score, 0);
  });

  it("确定性：同样输入必得同样输出", () => {
    const a = breakdownScore(72, "标题", "正文", "InfoQ 中文");
    const b = breakdownScore(72, "标题", "正文", "InfoQ 中文");

    assert.deepEqual(a, b);
  });
});
