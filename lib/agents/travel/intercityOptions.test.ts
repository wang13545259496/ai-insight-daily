import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { estimateDrivingCost, VEHICLE_DEFAULTS } from "./amap";
import { lowestSeatPrice } from "./variflight";
import type { TrainTicket } from "./variflight";

/**
 * 跨城方案（火车 + 自驾）测试。
 *
 * 重点是排序策略与座席筛选 —— 这两处都是实测踩坑后修正的：
 *   · 无座曾是推荐结果（最便宜），把高铁挤到后面
 *   · 只按价格排序会把 14 小时普速排在 4 小时高铁前面
 *   · 短途夜车曾被误判为「夕发朝至，可省一晚住宿」
 */

const ORIGINAL = {
  vf: process.env.VARIFLIGHT_API_KEY,
  amap: process.env.AMAP_WEB_KEY,
};

afterEach(() => {
  if (ORIGINAL.vf === undefined) delete process.env.VARIFLIGHT_API_KEY;
  else process.env.VARIFLIGHT_API_KEY = ORIGINAL.vf;

  if (ORIGINAL.amap === undefined) delete process.env.AMAP_WEB_KEY;
  else process.env.AMAP_WEB_KEY = ORIGINAL.amap;
});

function makeTrain(over: Partial<TrainTicket> = {}): TrainTicket {
  return {
    trainNumber: "G1",
    fromStation: "上海虹桥",
    toStation: "北京南",
    departTime: "09:00",
    arriveTime: "13:28",
    durationMinutes: 268,
    seats: [
      { seatName: "二等座", price: 553, ticketsLeft: 100 },
      { seatName: "一等座", price: 933, ticketsLeft: 10 },
      { seatName: "商务座", price: 1748, ticketsLeft: 2 },
    ],
    ...over,
  };
}

describe("travel/intercityOptions 座席筛选", () => {
  it("按偏好顺序命中座位", () => {
    const result = lowestSeatPrice(makeTrain(), ["一等座", "二等座"]);

    assert.equal(result?.seatName, "一等座");
    assert.equal(result?.price, 933);
  });

  it("★ 无座不作为正常推荐，即使它最便宜", () => {
    const train = makeTrain({
      seats: [
        { seatName: "无座", price: 100, ticketsLeft: 50 },
        { seatName: "二等座", price: 553, ticketsLeft: 100 },
      ],
    });

    const result = lowestSeatPrice(train, ["二等座"]);

    assert.equal(result?.seatName, "二等座", "应跳过无座");
    assert.equal(result?.price, 553);
  });

  it("除无座外无票时，才退回无座", () => {
    const train = makeTrain({
      seats: [{ seatName: "无座", price: 100, ticketsLeft: 50 }],
    });

    const result = lowestSeatPrice(train, ["二等座"]);

    assert.equal(result?.seatName, "无座");
    assert.equal(result?.price, 100);
  });

  it("偏好都没命中时取非无座的最低价", () => {
    const train = makeTrain({
      seats: [
        { seatName: "无座", price: 50, ticketsLeft: 9 },
        { seatName: "硬座", price: 177, ticketsLeft: 9 },
        { seatName: "硬卧", price: 300, ticketsLeft: 9 },
      ],
    });

    const result = lowestSeatPrice(train, ["二等座", "一等座"]);

    assert.equal(result?.seatName, "硬座");
    assert.equal(result?.price, 177);
  });

  it("跳过价格非正的座席", () => {
    const train = makeTrain({
      seats: [
        { seatName: "二等座", price: 0, ticketsLeft: 1 },
        { seatName: "一等座", price: 933, ticketsLeft: 1 },
      ],
    });

    assert.equal(lowestSeatPrice(train, ["二等座", "一等座"])?.price, 933);
  });

  it("无任何可用座席时返回 null", () => {
    assert.equal(lowestSeatPrice(makeTrain({ seats: [] }), ["二等座"]), null);
  });
});

describe("travel/intercityOptions 自驾成本", () => {
  it("油费按里程与油耗计算", () => {
    // 100 公里 × 7.5L/100km × 7.5 元/L = 56.25 → 56
    const cost = estimateDrivingCost(100_000, null);

    assert.equal(cost.fuel, 56);
    assert.equal(cost.tolls, 0);
    assert.equal(cost.total, 56);
  });

  it("过路费计入总价", () => {
    const cost = estimateDrivingCost(100_000, 50);

    assert.equal(cost.fuel, 56);
    assert.equal(cost.tolls, 50);
    assert.equal(cost.total, 106);
  });

  it("过路费为 null 时按 0 计", () => {
    assert.equal(estimateDrivingCost(100_000, null).tolls, 0);
  });

  it("可自定义油耗与油价", () => {
    // 200 公里 × 10L/100km × 8 元/L = 160
    const cost = estimateDrivingCost(200_000, null, { fuelPer100Km: 10, fuelPricePerLiter: 8 });

    assert.equal(cost.fuel, 160);
  });

  it("默认值对应约 0.56 元/公里（与国内实际相符）", () => {
    const perKm =
      (VEHICLE_DEFAULTS.fuelPer100Km / 100) * VEHICLE_DEFAULTS.fuelPricePerLiter;

    assert.ok(perKm > 0.5 && perKm < 0.65, `实际 ${perKm.toFixed(2)} 元/公里`);
  });

  it("距离为 0 或负数时油费为 0", () => {
    assert.equal(estimateDrivingCost(0, null).fuel, 0);
    assert.equal(estimateDrivingCost(-1000, null).fuel, 0);
  });
});

describe("travel/intercityOptions 未配置凭据时的降级", () => {
  it("未配置飞常准时火车查询返回错误且不发请求", async () => {
    delete process.env.VARIFLIGHT_API_KEY;

    const originalFetch = globalThis.fetch;
    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      throw new Error("不应发请求");
    }) as typeof fetch;

    try {
      const { fetchTrainOptions } = await import("./intercityOptions");
      const result = await fetchTrainOptions("上海", "北京", "2026-11-01", "comfort", 2);

      assert.equal(called, 0);
      assert.equal(result.options.length, 0);
      assert.ok(result.error?.includes("VARIFLIGHT_API_KEY"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("未配置高德时自驾返回错误且不发请求", async () => {
    delete process.env.AMAP_WEB_KEY;

    const originalFetch = globalThis.fetch;
    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      throw new Error("不应发请求");
    }) as typeof fetch;

    try {
      const { fetchDriveOption } = await import("./intercityOptions");
      const result = await fetchDriveOption("上海", "北京", 2);

      assert.equal(called, 0);
      assert.equal(result.option, null);
      assert.ok(result.error?.includes("AMAP_WEB_KEY"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
