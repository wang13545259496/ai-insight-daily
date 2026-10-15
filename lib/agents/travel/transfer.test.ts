import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickTransferItineraries } from "./variflight";
import type { TransferItinerary, TransferSegment } from "./variflight";

/**
 * 空铁联运的筛选逻辑测试。
 *
 * 接口实测行为（徐州→深圳、盐城→北京、西双版纳→上海三条线路验证）：
 *   · 返回「方案列表」，每个方案由若干段组成，段类型可能是航班或火车
 *   · 不返回价格，只有班次与时刻
 *   · 有些线路根本没有多段方案（只有直飞），此时需要回退
 */

function seg(over: Partial<TransferSegment> = {}): TransferSegment {
  return {
    kind: "航班",
    number: "MU1234",
    fromName: "徐州观音",
    fromCode: "XUZ",
    toName: "赣州黄金",
    toCode: "KOW",
    departAt: Date.parse("2026-11-01T09:00:00+08:00"),
    arriveAt: Date.parse("2026-11-01T11:00:00+08:00"),
    ...over,
  };
}

function itinerary(segments: TransferSegment[], durationMinutes?: number): TransferItinerary {
  const hasTrain = segments.some((s) => s.kind.includes("火车"));
  const hasFlight = segments.some((s) => s.kind.includes("航班"));

  const first = segments[0];
  const last = segments[segments.length - 1];

  const computed =
    first?.departAt != null && last?.arriveAt != null && last.arriveAt > first.departAt
      ? Math.round((last.arriveAt - first.departAt) / 60000)
      : 0;

  return {
    segments,
    hasTrain,
    hasFlight,
    durationMinutes: durationMinutes ?? computed,
    transferCities: segments.slice(0, -1).map((s) => s.toName),
  };
}

describe("travel/variflight 联运方案筛选", () => {
  it("★ 优先返回含火车段的方案（空铁联运的核心价值）", () => {
    const flightOnly = itinerary([seg(), seg({ number: "MU5678", kind: "航班" })]);
    const withTrain = itinerary([
      seg(),
      seg({ number: "G2789", kind: "火车", fromName: "赣州西", toName: "深圳" }),
    ]);

    const picked = pickTransferItineraries([flightOnly, withTrain]);

    assert.equal(picked.length, 1);
    assert.equal(picked[0].hasTrain, true);
    assert.ok(picked[0].segments.some((s) => s.number === "G2789"));
  });

  it("没有火车段时回退到航班中转", () => {
    const flightOnly = itinerary([
      seg({ number: "MU1" }),
      seg({ number: "MU2" }),
    ]);

    const picked = pickTransferItineraries([flightOnly]);

    assert.equal(picked.length, 1);
    assert.equal(picked[0].hasTrain, false);
  });

  it("单段方案被排除（那就是直达，与其它查询重复）", () => {
    const direct = itinerary([seg()]);

    assert.equal(pickTransferItineraries([direct]).length, 0);
  });

  it("同类中取段数最少的", () => {
    const twoLeg = itinerary([seg({ number: "A" }), seg({ number: "B" })]);
    const threeLeg = itinerary([seg({ number: "A" }), seg({ number: "B" }), seg({ number: "C" })]);

    const picked = pickTransferItineraries([threeLeg, twoLeg]);

    assert.equal(picked[0].segments.length, 2);
  });

  it("段数相同时取历时短的", () => {
    const slow = itinerary([seg({ number: "A" }), seg({ number: "B" })], 600);
    const fast = itinerary([seg({ number: "C" }), seg({ number: "D" })], 300);

    const picked = pickTransferItineraries([slow, fast]);

    assert.equal(picked[0].durationMinutes, 300);
  });

  it("尊重 max 上限", () => {
    const items = [
      itinerary([seg({ number: "A1" }), seg({ number: "A2", kind: "火车" })]),
      itinerary([seg({ number: "B1" }), seg({ number: "B2", kind: "火车" })]),
      itinerary([seg({ number: "C1" }), seg({ number: "C2", kind: "火车" })]),
    ];

    assert.equal(pickTransferItineraries(items, 2).length, 2);
    assert.equal(pickTransferItineraries(items, 1).length, 1);
  });

  it("空输入返回空数组", () => {
    assert.deepEqual(pickTransferItineraries([]), []);
  });

  it("全部是单段直飞时返回空（实测西双版纳→上海属此类）", () => {
    const directs = [itinerary([seg({ number: "A" })]), itinerary([seg({ number: "B" })])];

    assert.equal(pickTransferItineraries(directs).length, 0);
  });
});

describe("travel/variflight 联运方案结构", () => {
  it("hasTrain 与 hasFlight 反映段类型", () => {
    const mixed = itinerary([
      seg({ kind: "航班" }),
      seg({ kind: "火车", number: "G1" }),
    ]);

    assert.equal(mixed.hasTrain, true);
    assert.equal(mixed.hasFlight, true);
  });

  it("纯火车方案的 hasFlight 为 false", () => {
    const trainsOnly = itinerary([
      seg({ kind: "火车", number: "G3132" }),
      seg({ kind: "火车", number: "G20" }),
    ]);

    assert.equal(trainsOnly.hasFlight, false);
    assert.equal(trainsOnly.hasTrain, true);
  });

  it("历时由首段出发到末段到达推算", () => {
    const dep = Date.parse("2026-11-01T09:00:00+08:00");
    const arr = Date.parse("2026-11-01T14:00:00+08:00");

    const it = itinerary([
      seg({ number: "A", departAt: dep, arriveAt: dep + 3600000 }),
      seg({ number: "B", departAt: dep + 3600000, arriveAt: arr }),
    ]);

    assert.equal(it.durationMinutes, 300);
  });

  it("中转城市取中间段的到达地", () => {
    const it = itinerary([
      seg({ toName: "徐州东" }),
      seg({ toName: "北京南", number: "G20", kind: "火车" }),
    ]);

    assert.deepEqual(it.transferCities, ["徐州东"]);
  });
});
