import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { firstSentence, summaryOf } from "./summary";

/**
 * 摘要提取测试。
 *
 * 修的问题：历史卡片用 line-clamp-2 截断，中文无词边界，
 * 裁切点落在句中时读起来像文本重复。改为在服务端取完整首句。
 *
 * 用真实 overview 做回归用例 —— 这些都是项目里实际生成过的文本。
 */

describe("travel/summary 首句提取", () => {
  it("★ 真实杭州行程（回归用例）", () => {
    const text =
      "本次杭州4天3晚舒适型行程，以美食与博物馆为主线，兼顾西湖经典风光。考虑到航班深夜抵达且酒店在未来科技城，第一天仅安排机场至酒店入住，避免跨区奔波。第二天起以西湖东岸为核心。";

    const result = firstSentence(text);

    assert.equal(result, "本次杭州4天3晚舒适型行程，以美食与博物馆为主线，兼顾西湖经典风光。");
  });

  it("★ 引号内含句号时不误切（回归用例）", () => {
    // 这类开篇以冒号收尾、属于引导句，应继续并上下一句
    const text =
      "这趟厦门5天4晚舒适型行程围绕「美食+自然风光」双主题展开，节奏松紧结合：抵达日先落脚中山路老城片区。第二天集中玩鼓浪屿。";

    const result = firstSentence(text);

    // 第一句以「：」收尾不是结束符，因此取到第一个「。」为止
    assert.ok(result.includes("节奏松紧结合"), `实际：${result}`);
    assert.ok(result.endsWith("。"));
  });

  it("开篇短句会被跳过，并上后续内容", () => {
    // 「这是一条测试。」仅 7 字，低于默认下限 20
    const text = "这是一条测试。本次南京5日行程以历史古迹为主题，兼顾舒适型节奏。第三天前往夫子庙。";

    const result = firstSentence(text);

    assert.ok(result.length >= 20, `实际长度 ${result.length}`);
    assert.ok(result.includes("南京"));
  });

  it("叹号与问号也视为句末（句长达下限时）", () => {
    const text = "这趟杭州行程非常值得期待，景点与美食都很丰富！后面还有很多安排内容。";

    const result = firstSentence(text);

    assert.equal(result, "这趟杭州行程非常值得期待，景点与美食都很丰富！");
  });

  it("★ 过短的感叹句不单独成摘要，继续并上下一句", () => {
    // 「这趟行程非常值得期待！」仅 11 字，低于默认下限 20，
    // 单独作为摘要信息量不足，应并上后续内容
    const text = "这趟行程非常值得期待！后面还有详细的安排与说明内容。";

    const result = firstSentence(text);

    assert.ok(result.length >= 20, `实际长度 ${result.length}`);
    assert.ok(result.includes("后面"), `实际：${result}`);
  });

  it("无结束符时返回原文", () => {
    const text = "这是一段没有句号的文字，长度也超过了默认的下限值";

    assert.equal(firstSentence(text), text);
  });

  it("原文短于下限时原样返回", () => {
    assert.equal(firstSentence("很短"), "很短");
    assert.equal(firstSentence(""), "");
  });

  it("空白与 null 安全", () => {
    assert.equal(firstSentence("   "), "");
    assert.equal(firstSentence(null as unknown as string), "");
    assert.equal(firstSentence(undefined as unknown as string), "");
  });

  it("首句恰好达下限时采用", () => {
    const text = "一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾。第二句内容。";
    const result = firstSentence(text, 20);

    assert.equal(result, "一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾。");
  });
});

describe("travel/summary 卡片摘要", () => {
  it("★ 超长首句按字符截断并加省略号", () => {
    const text =
      "本次杭州4天3晚舒适型行程以美食与博物馆为主线兼顾西湖经典风光并考虑航班深夜抵达等多项因素综合安排。第二句。";

    const result = summaryOf(text, 30);

    assert.ok(result.length <= 31, `实际长度 ${result.length}`);
    assert.ok(result.endsWith("…"));
  });

  it("未超长时保留原句（含句号）", () => {
    const text = "本次杭州4天3晚舒适型行程，以美食为主线。第二句内容。";

    const result = summaryOf(text, 60);

    assert.equal(result, "本次杭州4天3晚舒适型行程，以美食为主线。");
    assert.ok(!result.endsWith("…"));
  });

  it("截断处去掉尾部空白", () => {
    const result = summaryOf("一二三四五六七八九十 壹贰叁肆伍陆柒捌玖拾 后来还有更多内容。", 15);

    assert.ok(!result.includes(" …"), `实际：${result}`);
  });

  it("真实厦门行程（回归用例）", () => {
    const text =
      "这趟厦门5天4晚舒适型行程围绕「美食+自然风光」双主题展开，节奏松紧结合：抵达日先落脚中山路—八市老城片区，用沙茶面与海鲜大排档打开味觉；第二天集中玩鼓浪屿。";

    const result = summaryOf(text, 60);

    assert.ok(result.length <= 61, `实际长度 ${result.length}`);
    assert.ok(result.length > 0);
  });
});
