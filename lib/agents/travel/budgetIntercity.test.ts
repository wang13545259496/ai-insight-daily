import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBudgetPlan, chooseIntercityForBudget } from "./budget";
import type { IntercityOption } from "./intercityOptions";
import type { FlightQuote } from "./types";

/**
 * 跨城方式接入预算的测试。
 *
 * 修的问题：预算的「交通」科目原本一律按机票计价，
 * 于是出现「行程页推荐高铁、预算却按机票算」的矛盾 ——
 * 实测上海→北京机票 ¥700/人 与高铁 ¥553/人 相差 21%。
 */

function makeOption(over: Partial<IntercityOption> = {}): IntercityOption {
  return {
    mode: "train",
    label: "高铁",
    totalPrice: 1106,
    perPerson: 553,
    durationMinutes: 273,
    reference: "G1",
    departTime: "09:00",
    arriveTime: "13:33",
    breakdown: "上海虹桥→北京南｜二等座",
    confidence: "live",
    ...over,
  };
}

function makeFlight(over: Partial<FlightQuote> = {}): FlightQuote {
  return {
    confidence: "live",
    provider: "variflight",
    note: "测试",
    fetchedAt: new Date().toISOString(),
    pricePerAdult: 700,
    totalPrice: 1400,
    currency: "CNY",
    outbound: [
      { from: "SHA", to: "PEK", departAt: "2026-11-01T09:00:00", arriveAt: "2026-11-01T11:30:00", carrier: "MU", flightNumber: "MU1" },
    ],
    inbound: [
      { from: "PEK", to: "SHA", departAt: "2026-11-04T19:00:00", arriveAt: "2026-11-04T21:30:00", carrier: "MU", flightNumber: "MU2" },
    ],
    totalDurationMinutes: 300,
    stops: 0,
    ...over,
  };
}

describe("travel/budget chooseIntercityForBudget", () => {
  it("高铁比机票省时选中高铁", () => {
    // 高铁往返 553×2×2 = 2212，机票 1400 → 机票更省，应返回 null
    const chosen = chooseIntercityForBudget([makeOption()], 2, 0, makeFlight());

    assert.equal(chosen, null, "机票明显更省时应沿用机票");
  });

  it("★ 高铁比机票省时改用高铁计价（回归：曾一律按机票算）", () => {
    // 高铁往返 300×2×2 = 1200，机票 2000 → 高铁更省
    const option = makeOption({ perPerson: 300, label: "高铁" });
    const flight = makeFlight({ pricePerAdult: 1000, totalPrice: 2000 });

    const chosen = chooseIntercityForBudget([option], 2, 0, flight);

    assert.ok(chosen, "应选中高铁");
    assert.equal(chosen.label, "高铁");
    assert.equal(chosen.roundTripTotal, 1200);
  });

  it("往返总价 = 单程单价 × 2 × 人数", () => {
    const chosen = chooseIntercityForBudget(
      [makeOption({ perPerson: 400 })],
      3,
      0,
      makeFlight({ pricePerAdult: 2000, totalPrice: 6000 }),
    );

    assert.equal(chosen?.roundTripTotal, 400 * 2 * 3);
  });

  it("无机票时直接采用最省的方式", () => {
    const chosen = chooseIntercityForBudget([makeOption({ perPerson: 300 })], 2, 0, null);

    assert.ok(chosen);
    assert.equal(chosen.roundTripTotal, 1200);
  });

  it("自驾把耗时折算进成本后再比较", () => {
    const train = makeOption({ mode: "train", label: "高铁", perPerson: 300, durationMinutes: 60 });
    // 自驾人均同价但耗时 300 分钟 → 210 分钟 × 0.8 = 168 元惩罚
    const drive = makeOption({ mode: "drive", label: "自驾", perPerson: 300, durationMinutes: 300 });

    const chosen = chooseIntercityForBudget([train, drive], 2, 0, null);

    assert.equal(chosen?.label, "高铁", "耗时相近价格时应选火车");
  });

  it("夕发朝至的卧铺标记 savesNight", () => {
    const sleeper = makeOption({
      label: "卧铺",
      perPerson: 275,
      breakdown: "上海→北京丰台｜硬卧｜夕发朝至，可省一晚住宿",
    });

    const chosen = chooseIntercityForBudget([sleeper], 2, 0, null);

    assert.equal(chosen?.savesNight, true);
  });

  it("空方案或未提供时返回 null", () => {
    assert.equal(chooseIntercityForBudget([], 2, 0, null), null);
    assert.equal(chooseIntercityForBudget(undefined, 2, 0, null), null);
  });
});

describe("travel/budget 交通科目采用跨城方式", () => {
  const base = {
    total: 12000,
    party: { adults: 2, children: 0 },
    nights: 3,
    days: 4,
    style: "comfort" as const,
    hotel: null,
    rooms: 1,
    peakSeason: false,
  };

  it("★ 交通科目按选中的高铁计价（而非机票）", () => {
    const plan = buildBudgetPlan({
      ...base,
      flight: makeFlight({ pricePerAdult: 1000, totalPrice: 2000 }),
      intercityOptions: [makeOption({ perPerson: 300 })],
    });

    const transport = plan.categories.find((c) => c.key === "transport");

    // 300 × 2 × 2 = 1200
    assert.equal(transport?.amount, 1200);
    assert.ok(transport?.detail.includes("高铁"), `明细应说明高铁，实际：${transport?.detail}`);
  });

  it("无跨城方案时仍按机票计价", () => {
    const plan = buildBudgetPlan({
      ...base,
      flight: makeFlight({ pricePerAdult: 700, totalPrice: 1400 }),
    });

    const transport = plan.categories.find((c) => c.key === "transport");

    assert.equal(transport?.amount, 1400);
  });

  it("机票更省时保留机票计价", () => {
    const plan = buildBudgetPlan({
      ...base,
      flight: makeFlight({ pricePerAdult: 200, totalPrice: 400 }),
      intercityOptions: [makeOption({ perPerson: 800 })],
    });

    const transport = plan.categories.find((c) => c.key === "transport");

    assert.equal(transport?.amount, 400);
  });

  it("★ 夕发朝至的卧铺降低最低可行预算（回归：曾按原晚数算）", () => {
    // 说明：没有酒店报价时，住宿科目本身是按权重分配的弹性科目，
    // 不受晚数影响；受「省一晚」影响的是最低可行预算（minimumViable），
    // 而最低可行预算决定了可行性与诊断文案。
    const sleepOption = makeOption({
      label: "卧铺",
      perPerson: 275,
      breakdown: "上海→北京丰台｜硬卧｜夕发朝至，可省一晚住宿",
    });

    const withSleeper = buildBudgetPlan({
      ...base,
      flight: null,
      intercityOptions: [sleepOption],
    });

    const withoutSleeper = buildBudgetPlan({
      ...base,
      flight: null,
      intercityOptions: [makeOption({ perPerson: 275, breakdown: "上海→北京丰台｜硬卧" })],
    });

    assert.ok(
      withSleeper.minimumViable < withoutSleeper.minimumViable,
      `卧铺最低可行 ${withSleeper.minimumViable} 应低于常规 ${withoutSleeper.minimumViable}`,
    );

    // 差额应正好约等于一晚房价（舒适型 350 元/间/晚 × 1 间）
    const diff = withoutSleeper.minimumViable - withSleeper.minimumViable;

    assert.ok(diff > 200 && diff < 500, `差额 ${diff} 应接近一晚房价`);
  });

  it("有酒店报价时不减晚数（报价按实际查询晚数给出）", () => {
    const hotel = {
      confidence: "live" as const,
      provider: "rollinggo",
      note: "测试",
      fetchedAt: new Date().toISOString(),
      name: "测试酒店",
      rating: 4,
      pricePerNight: 400,
      totalPrice: 1200,
      currency: "CNY" as const,
      rooms: 1,
      location: "北京",
    };

    const plan = buildBudgetPlan({
      ...base,
      flight: null,
      hotel,
      intercityOptions: [
        makeOption({
          label: "卧铺",
          perPerson: 275,
          breakdown: "上海→北京丰台｜硬卧｜夕发朝至，可省一晚住宿",
        }),
      ],
    });

    const acc = plan.categories.find((c) => c.key === "accommodation");

    // 有报价时以报价为准，不做减晚处理
    assert.equal(acc?.amount, 1200);
  });

  it("无酒店报价时住宿明细在卧铺方案下说明省一晚", () => {
    const plan = buildBudgetPlan({
      ...base,
      flight: null,
      intercityOptions: [
        makeOption({
          label: "卧铺",
          perPerson: 275,
          breakdown: "上海→北京丰台｜硬卧｜夕发朝至，可省一晚住宿",
        }),
      ],
    });

    const acc = plan.categories.find((c) => c.key === "accommodation");

    assert.ok(
      acc?.detail.includes("省下一晚"),
      `明细应说明省一晚，实际：${acc?.detail}`,
    );
    assert.ok(acc?.detail.includes("2 晚"), `应按 2 晚计，实际：${acc?.detail}`);
  });

  it("打车费仍计入交通科目，与跨城方式叠加", () => {
    const plan = buildBudgetPlan({
      ...base,
      flight: null,
      taxiCost: 100,
      intercityOptions: [makeOption({ perPerson: 300 })],
    });

    const transport = plan.categories.find((c) => c.key === "transport");

    // 300 × 2 × 2 + 100 = 1300
    assert.equal(transport?.amount, 1300);
  });
});
