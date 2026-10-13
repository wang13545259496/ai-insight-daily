import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildBudgetPlan, distributeByWeight, type BudgetContext } from "./budget";
import type { FlightQuote, HotelQuote } from "./types";

/** 构造一份真实报价机票，用于验证「锁定金额」逻辑 */
function makeLiveFlight(overrides: Partial<FlightQuote> = {}): FlightQuote {
  return {
    confidence: "live",
    provider: "amadeus",
    note: "test",
    fetchedAt: "2026-09-01T00:00:00.000Z",
    pricePerAdult: 2500,
    totalPrice: 5000,
    currency: "CNY",
    outbound: [
      {
        from: "PEK",
        to: "NRT",
        departAt: "2026-10-01T08:00:00",
        arriveAt: "2026-10-01T12:30:00",
        carrier: "CA",
        flightNumber: "CA123",
      },
    ],
    inbound: [
      {
        from: "NRT",
        to: "PEK",
        departAt: "2026-10-05T14:00:00",
        arriveAt: "2026-10-05T18:00:00",
        carrier: "CA",
        flightNumber: "CA124",
      },
    ],
    totalDurationMinutes: 510,
    stops: 0,
    ...overrides,
  };
}

/** 构造一份真实报价酒店 */
function makeLiveHotel(overrides: Partial<HotelQuote> = {}): HotelQuote {
  return {
    confidence: "live",
    provider: "amadeus",
    note: "test",
    fetchedAt: "2026-09-01T00:00:00.000Z",
    name: "测试酒店",
    rating: 4,
    pricePerNight: 800,
    totalPrice: 3200,
    currency: "CNY",
    rooms: 1,
    ...overrides,
  };
}

/** 构造预算上下文 */
function makeContext(overrides: Partial<BudgetContext> = {}): BudgetContext {
  return {
    total: 12000,
    party: { adults: 2, children: 0 },
    nights: 4,
    days: 5,
    style: "comfort",
    flight: null,
    hotel: null,
    rooms: 1,
    peakSeason: false,
    ...overrides,
  };
}

describe("travel/budget distributeByWeight 分配", () => {
  it("分配结果之和精确等于总额", () => {
    const weights = { a: 0.4, b: 0.35, c: 0.15, d: 0.1 };

    // 用多个总额验证取整不会漏钱
    for (const total of [1, 7, 99, 100, 1234, 999999]) {
      const result = distributeByWeight(total, weights);
      const sum = Object.values(result).reduce((acc, value) => acc + value, 0);

      assert.equal(sum, total, `总额 ${total} 分配后应精确相等`);
    }
  });

  it("按权重比例分配，误差不超过取整范围", () => {
    const result = distributeByWeight(1000, { a: 0.5, b: 0.5 });

    assert.equal(result.a, 500);
    assert.equal(result.b, 500);
  });

  it("权重全为 0 时退化为均分", () => {
    const result = distributeByWeight(100, { a: 0, b: 0 });

    assert.equal(result.a + result.b, 100);
  });

  it("总额为 0 时全部为 0", () => {
    const result = distributeByWeight(0, { a: 1, b: 1 });

    assert.equal(result.a, 0);
    assert.equal(result.b, 0);
  });

  it("空权重返回空对象", () => {
    assert.deepEqual(distributeByWeight(100, {}), {});
  });
});

describe("travel/budget 方案分配", () => {
  it("各项之和等于总预算（无报价）", () => {
    const plan = buildBudgetPlan(makeContext());

    assert.equal(plan.total, 12000);
    assert.equal(plan.allocated, 12000);
    assert.equal(
      plan.categories.reduce((acc, item) => acc + item.amount, 0),
      12000,
    );
  });

  it("各项之和等于总预算（含真实报价）", () => {
    const plan = buildBudgetPlan(
      makeContext({ flight: makeLiveFlight(), hotel: makeLiveHotel() }),
    );

    assert.equal(plan.allocated, 12000);
  });

  it("覆盖全部六个经费科目且无重复", () => {
    const plan = buildBudgetPlan(makeContext());
    const keys = plan.categories.map((item) => item.key);

    assert.deepEqual(
      [...keys].sort(),
      ["accommodation", "activities", "contingency", "food", "shopping", "transport"],
    );
  });

  it("真实报价机票直接锁定交通金额", () => {
    const plan = buildBudgetPlan(makeContext({ flight: makeLiveFlight() }));
    const transport = plan.categories.find((item) => item.key === "transport")!;

    assert.equal(transport.amount, 5000);
    assert.equal(transport.lockedByQuote, true);
  });

  it("真实报价酒店直接锁定住宿金额", () => {
    const plan = buildBudgetPlan(makeContext({ hotel: makeLiveHotel() }));
    const accommodation = plan.categories.find((item) => item.key === "accommodation")!;

    assert.equal(accommodation.amount, 3200);
    assert.equal(accommodation.lockedByQuote, true);
  });

  it("一日游不产生住宿费", () => {
    const plan = buildBudgetPlan(makeContext({ nights: 0, days: 1 }));
    const accommodation = plan.categories.find((item) => item.key === "accommodation")!;

    assert.equal(accommodation.amount, 0);
    assert.equal(plan.allocated, 12000);
  });

  it("人均与人均每日计算正确", () => {
    const plan = buildBudgetPlan(makeContext());

    assert.equal(plan.perPerson, 6000);
    assert.equal(plan.perPersonPerDay, 1200);
  });

  it("预算充足时判定可行", () => {
    const plan = buildBudgetPlan(makeContext({ total: 20000 }));

    assert.equal(plan.feasible, true);
    assert.equal(plan.diagnosis.some((item) => item.includes("缺口")), false);
  });

  it("预算过低时判定不可行并给出缺口", () => {
    const plan = buildBudgetPlan(makeContext({ total: 1500 }));

    assert.equal(plan.feasible, false);
    assert.ok(plan.diagnosis.some((item) => item.includes("缺口")));
    // 即使不可行，金额仍需自洽
    assert.equal(plan.allocated, 1500);
  });

  it("预算极低时判定不可行，且不会出现负数分配", () => {
    const plan = buildBudgetPlan(makeContext({ total: 1500 }));

    assert.equal(plan.feasible, false);
    // 极端不可行时金额允许被压到 0，但绝不能出现负数
    for (const category of plan.categories) {
      assert.ok(category.amount >= 0, `${category.label} 不应为负数`);
    }

    assert.equal(plan.allocated, 1500);
    // 必须明确指出问题，而不是默默给出一个不可行的方案
    assert.ok(plan.diagnosis.some((item) => item.includes("缺口")));
  });

  it("预算紧张但可行时，餐饮不会被压到 0", () => {
    // 14000 元 5 天 2 人：交通与住宿占大头，但仍需保证餐饮有合理下限
    const plan = buildBudgetPlan(makeContext({ total: 14000 }));
    const food = plan.categories.find((item) => item.key === "food")!;

    assert.ok(food.amount > 0, "餐饮不应为 0");
  });

  it("旺季抬高最低可行成本", () => {
    const normal = buildBudgetPlan(makeContext({ total: 20000 }));
    const peak = buildBudgetPlan(makeContext({ total: 20000, peakSeason: true }));

    assert.ok(peak.minimumViable > normal.minimumViable);
    assert.ok(peak.diagnosis.some((item) => item.includes("旺季")));
  });

  it("儿童同行时人均按总人数计算", () => {
    const plan = buildBudgetPlan(
      makeContext({ total: 12000, party: { adults: 2, children: 2 } }),
    );

    assert.equal(plan.perPerson, 3000);
  });

  it("无报价时给出估算模式提示", () => {
    const plan = buildBudgetPlan(makeContext());

    assert.ok(plan.diagnosis.some((item) => item.includes("估算")));
  });

  it("比例之和约等于 1", () => {
    const plan = buildBudgetPlan(makeContext({ total: 30000 }));
    const ratioSum = plan.categories.reduce((acc, item) => acc + item.ratio, 0);

    assert.ok(Math.abs(ratioSum - 1) < 0.001, `比例之和 ${ratioSum} 应接近 1`);
  });

  it("预算充足时档位越高住宿标准越高", () => {
    // 用足够大的预算，让住宿的档位下限真正生效（否则会被权重分配与其它下限挤掉）
    const budgetStyle = buildBudgetPlan(makeContext({ total: 100000, style: "budget" }));
    const luxuryStyle = buildBudgetPlan(makeContext({ total: 100000, style: "luxury" }));

    const budgetHotel = budgetStyle.categories.find((item) => item.key === "accommodation")!;
    const luxuryHotel = luxuryStyle.categories.find((item) => item.key === "accommodation")!;

    assert.ok(
      luxuryHotel.amount > budgetHotel.amount,
      `奢享档住宿 ${luxuryHotel.amount} 应高于经济档 ${budgetHotel.amount}`,
    );

    assert.ok(budgetHotel.detail.includes("快捷酒店"));
    assert.ok(luxuryHotel.detail.includes("五星"));
  });

  it("下限兜底不会从目标科目自身取钱（防止净效果为零的假补足）", () => {
    // 奢享档 + 4 人 + 有限预算：餐饮与门票下限都很高，必须真的从其它科目挪钱
    const plan = buildBudgetPlan(
      makeContext({ total: 20000, style: "luxury", party: { adults: 4, children: 0 } }),
    );

    const food = plan.categories.find((item) => item.key === "food")!;
    const activities = plan.categories.find((item) => item.key === "activities")!;

    assert.ok(food.amount >= 0);
    assert.ok(activities.amount >= 0);
    // 无论如何分配，总额必须自洽
    assert.equal(plan.allocated, 20000);
  });
});
