import assert from "node:assert/strict";
import test from "node:test";

import { inspectLengthGuide } from "./ai-summary";

/**
 * 篇幅分档的边界与开关。
 *
 * 为什么值得测：这三档直接决定每条新闻的输出 token（即成本），
 * 而阈值改动不会有任何报错，只会在账单上体现。用测试把边界钉住。
 */

const SHORT = 600;
const LONG = 1600;

function text(chars: number) {
  return "字".repeat(chars);
}

test("空正文按短素材处理", () => {
  const r = inspectLengthGuide("");

  assert.equal(r.tier, "short");
  assert.equal(r.chars, 0);
});

test("空白不计入字数", () => {
  const withSpaces = "字".repeat(300) + " ".repeat(50) + "\n\n" + "字".repeat(299);

  assert.equal(inspectLengthGuide(withSpaces).chars, 599);
  assert.equal(inspectLengthGuide(withSpaces).tier, "short");
});

test("600 字是短素材的上界", () => {
  assert.equal(inspectLengthGuide(text(SHORT - 1)).tier, "short");
  assert.equal(inspectLengthGuide(text(SHORT)).tier, "medium");
});

test("1600 字是中等素材的上界", () => {
  assert.equal(inspectLengthGuide(text(LONG)).tier, "medium");
  assert.equal(inspectLengthGuide(text(LONG + 1)).tier, "long");
});

test("各档给出的字数区间互不相同，且长档沿用原区间", () => {
  const short = inspectLengthGuide(text(100)).guide;
  const medium = inspectLengthGuide(text(1000)).guide;
  const long = inspectLengthGuide(text(3000)).guide;

  assert.match(short, /background：50-80 字/);
  assert.match(medium, /background：70-130 字/);
  assert.match(long, /background：80-180 字/);

  // long 档必须与系统提示词一致，否则长文行为被悄悄改掉
  assert.match(long, /content：300-700 字/);
  assert.match(long, /investmentView：80-200 字/);
});

test("篇幅块里写明素材字数，并要求覆盖系统提示词", () => {
  const r = inspectLengthGuide(text(750));

  assert.match(r.guide, /约 750 字/);
  assert.match(r.guide, /覆盖/);
  assert.match(r.guide, /不要为凑字数扩写/);
});

test("AI_LENGTH_GUIDE=off 时完全不注入篇幅块", () => {
  const original = process.env.AI_LENGTH_GUIDE;

  try {
    process.env.AI_LENGTH_GUIDE = "off";

    assert.equal(inspectLengthGuide(text(1000)).guide, "");
  } finally {
    if (original === undefined) delete process.env.AI_LENGTH_GUIDE;
    else process.env.AI_LENGTH_GUIDE = original;
  }
});

test("其它取值（含空串）不关闭篇幅块", () => {
  const original = process.env.AI_LENGTH_GUIDE;

  try {
    for (const value of ["", "on", "OFF", "0"]) {
      process.env.AI_LENGTH_GUIDE = value;

      assert.notEqual(inspectLengthGuide(text(1000)).guide, "", `value=${value} 不该关闭`);
    }
  } finally {
    if (original === undefined) delete process.env.AI_LENGTH_GUIDE;
    else process.env.AI_LENGTH_GUIDE = original;
  }
});
