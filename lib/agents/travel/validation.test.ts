import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { addDays, today } from "./date";
import { normalizeTripQuery, TravelValidationError } from "./validation";

/**
 * 用「相对今天」的日期构造用例。
 * 不写死具体日期：一是避免测试随时间推移而失效，二是「去程不能是过去」
 * 这条规则本身就依赖当天日期。
 */
const BASE_DATE = addDays(today(), 7)!;
const RETURN_DATE = addDays(BASE_DATE, 4)!;

/** 构造一份合法输入，便于逐项覆盖 */
function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    origin: "北京",
    destination: "东京",
    departDate: BASE_DATE,
    returnDate: RETURN_DATE,
    party: { adults: 2, children: 0 },
    budget: 12000,
    style: "comfort",
    interests: ["美食"],
    ...overrides,
  };
}

describe("travel/validation 合法输入", () => {
  it("归一化后字段完整", () => {
    const { query, warnings } = normalizeTripQuery(makeInput());

    assert.equal(query.origin, "北京");
    assert.equal(query.destination, "东京");
    assert.equal(query.party.adults, 2);
    assert.equal(query.budget, 12000);
    assert.equal(query.style, "comfort");
    assert.deepEqual(query.interests, ["美食"]);
    assert.deepEqual(warnings, []);
  });

  it("去掉城市名首尾空白并压缩内部空格", () => {
    const { query } = normalizeTripQuery(makeInput({ origin: "  上海  " }));

    assert.equal(query.origin, "上海");
  });

  it("缺省 style 时按舒适型处理且不报错", () => {
    const { query } = normalizeTripQuery(makeInput({ style: undefined }));

    assert.equal(query.style, "comfort");
  });
});

describe("travel/validation 拒绝非法输入", () => {
  it("缺少出发城市", () => {
    assert.throws(
      () => normalizeTripQuery(makeInput({ origin: "" })),
      (error: unknown) =>
        error instanceof TravelValidationError && error.errors.some((e) => e.includes("出发城市")),
    );
  });

  it("出发地与目的地相同", () => {
    assert.throws(
      () => normalizeTripQuery(makeInput({ destination: "北京" })),
      (error: unknown) =>
        error instanceof TravelValidationError && error.errors.some((e) => e.includes("不能相同")),
    );
  });

  it("返程早于去程", () => {
    assert.throws(
      () => normalizeTripQuery(makeInput({ returnDate: addDays(BASE_DATE, -1)! })),
      (error: unknown) =>
        error instanceof TravelValidationError && error.errors.some((e) => e.includes("返程日期不能早")),
    );
  });

  it("行程超过上限", () => {
    assert.throws(
      () => normalizeTripQuery(makeInput({ returnDate: addDays(BASE_DATE, 60)! })),
      (error: unknown) =>
        error instanceof TravelValidationError && error.errors.some((e) => e.includes("行程过长")),
    );
  });

  it("成人数为 0", () => {
    assert.throws(
      () => normalizeTripQuery(makeInput({ party: { adults: 0, children: 0 } })),
      (error: unknown) =>
        error instanceof TravelValidationError && error.errors.some((e) => e.includes("成人数")),
    );
  });

  it("预算低于下限", () => {
    assert.throws(
      () => normalizeTripQuery(makeInput({ budget: 50 })),
      (error: unknown) =>
        error instanceof TravelValidationError && error.errors.some((e) => e.includes("预算")),
    );
  });

  it("一次性汇总多条错误，便于表单逐项提示", () => {
    try {
      normalizeTripQuery(makeInput({ origin: "", budget: 10 }));

      assert.fail("应当抛出 TravelValidationError");
    } catch (error) {
      assert.ok(error instanceof TravelValidationError);
      assert.ok(error.errors.length >= 2);
    }
  });
});

describe("travel/validation 告警", () => {
  it("未识别的档位退回舒适型并告警", () => {
    const { query, warnings } = normalizeTripQuery(makeInput({ style: "超豪华" }));

    assert.equal(query.style, "comfort");
    assert.ok(warnings.some((item) => item.includes("预算档位")));
  });

  it("去返程同一天提示一日游", () => {
    const { warnings } = normalizeTripQuery(
      makeInput({ returnDate: BASE_DATE }),
    );

    assert.ok(warnings.some((item) => item.includes("一日游")));
  });

  it("带儿童时提示票价规则", () => {
    const { warnings } = normalizeTripQuery(makeInput({ party: { adults: 2, children: 1 } }));

    assert.ok(warnings.some((item) => item.includes("儿童")));
  });

  it("人均每日预算过低时给出提示", () => {
    const { warnings } = normalizeTripQuery(makeInput({ budget: 1000 }));

    assert.ok(warnings.some((item) => item.includes("人均每日")));
  });

  it("去程日期早于今天时提示", () => {
    const past = addDays(today(), -3)!;
    const { warnings } = normalizeTripQuery(
      makeInput({ departDate: past, returnDate: addDays(past, 3)! }),
    );

    assert.ok(warnings.some((item) => item.includes("早于今天")));
  });

  it("偏好标签去重且限制数量", () => {
    const { query } = normalizeTripQuery(
      makeInput({ interests: ["美食", "美食", "购物", "", "博物馆"] }),
    );

    assert.deepEqual(query.interests, ["美食", "购物", "博物馆"]);
  });
});

describe("travel/validation 非对象输入", () => {
  it("null 输入被拒绝", () => {
    assert.throws(() => normalizeTripQuery(null), TravelValidationError);
  });

  it("字符串输入被拒绝", () => {
    assert.throws(() => normalizeTripQuery("北京"), TravelValidationError);
  });
});
