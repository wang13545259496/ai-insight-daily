import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CITY_COORDS,
  FARE_CONSTANTS,
  baseFareForDistance,
  coordsOf,
  describeFareBasis,
  estimatePerAdultFare,
  greatCircleDistance,
  leadTimeFactor,
  routeDistance,
} from "./fareEstimate";

/**
 * 距离定价测试。
 *
 * 核心目标：修正「飞三亚与飞乌鲁木齐同价」的问题——
 * 原实现按档位固定基准价，与航线距离无关。
 */

describe("travel/fareEstimate 距离计算", () => {
  it("同一点距离为 0", () => {
    assert.equal(greatCircleDistance([39.9, 116.41], [39.9, 116.41]), 0);
  });

  it("北京到上海的直线距离与实际相符（约 1070 公里）", () => {
    const d = greatCircleDistance([39.9, 116.41], [31.23, 121.47]);

    assert.ok(d > 1000 && d < 1150, `实际 ${d} 公里，应在 1000-1150 区间`);
  });

  it("北京到乌鲁木齐明显远于北京到上海", () => {
    const shanghai = routeDistance("BJS", "SHA");
    const urumqi = routeDistance("BJS", "URC");

    assert.ok(shanghai !== null && urumqi !== null);
    assert.ok(urumqi > shanghai * 2, "乌鲁木齐应比上海远两倍以上");
  });

  it("跨半球航线计算正确（北京到纽约约 11000 公里）", () => {
    const d = routeDistance("BJS", "NYC");

    assert.ok(d !== null && d > 10500 && d < 11500, `实际 ${d} 公里`);
  });

  it("未收录的城市返回 null", () => {
    assert.equal(coordsOf("XXX"), null);
    assert.equal(routeDistance("BJS", "ZZZ"), null);
  });

  it("城市码大小写不敏感", () => {
    assert.deepEqual(coordsOf("bjs"), coordsOf("BJS"));
  });
});

describe("travel/fareEstimate 票价模型", () => {
  it("距离越远价格越高", () => {
    const near = baseFareForDistance(500);
    const mid = baseFareForDistance(1500);
    const far = baseFareForDistance(3000);

    assert.ok(near < mid && mid < far);
  });

  it("长航线单位成本递减（衰减生效）", () => {
    // 1500 公里以内每公里 0.55；超出部分按 0.85 衰减
    const a = baseFareForDistance(1000);
    const b = baseFareForDistance(2000);

    const perKmShort = (a - FARE_CONSTANTS.baseFare) / 1000;
    const perKmLong = (b - FARE_CONSTANTS.baseFare) / 2000;

    assert.ok(perKmLong < perKmShort, "长航线每公里成本应更低");
  });

  it("往返价低于两张单程", () => {
    const input = {
      distanceKm: 1500,
      roundTrip: true,
      cabin: "economy" as const,
      peakSeason: false,
      daysUntilDeparture: 15,
    };

    const roundTrip = estimatePerAdultFare(input);
    const twoOneWay = estimatePerAdultFare({ ...input, roundTrip: false }) * 2;

    assert.ok(roundTrip < twoOneWay, `往返 ${roundTrip} 应低于两张单程 ${twoOneWay}`);
  });

  it("舱位系数生效", () => {
    const base = {
      distanceKm: 2000,
      roundTrip: true,
      peakSeason: false,
      daysUntilDeparture: 20,
    };

    const economy = estimatePerAdultFare({ ...base, cabin: "economy" });
    const premium = estimatePerAdultFare({ ...base, cabin: "premium" });
    const business = estimatePerAdultFare({ ...base, cabin: "business" });

    assert.ok(economy < premium && premium < business);
  });

  it("旺季价格高于淡季", () => {
    const base = {
      distanceKm: 2000,
      roundTrip: true,
      cabin: "economy" as const,
      daysUntilDeparture: 20,
    };

    assert.ok(
      estimatePerAdultFare({ ...base, peakSeason: true }) >
        estimatePerAdultFare({ ...base, peakSeason: false }),
    );
  });

  it("提前期系数：临期上浮、提前优惠、中期不变", () => {
    assert.equal(leadTimeFactor(3), FARE_CONSTANTS.lastMinuteFactor);
    assert.equal(leadTimeFactor(7), FARE_CONSTANTS.lastMinuteFactor);
    assert.equal(leadTimeFactor(15), 1);
    assert.equal(leadTimeFactor(30), FARE_CONSTANTS.advanceFactor);
    assert.equal(leadTimeFactor(null), 1);
  });

  it("关键回归：短途与长途价格不再相同（原实现的缺陷）", () => {
    const base = {
      roundTrip: true,
      cabin: "economy" as const,
      peakSeason: false,
      daysUntilDeparture: 30,
    };

    // 北京→上海（约 1070 公里）与北京→乌鲁木齐（约 2400 公里）
    const toShanghai = estimatePerAdultFare({
      ...base,
      distanceKm: routeDistance("BJS", "SHA") ?? 0,
    });
    const toUrumqi = estimatePerAdultFare({
      ...base,
      distanceKm: routeDistance("BJS", "URC") ?? 0,
    });

    assert.ok(
      toUrumqi > toShanghai * 1.4,
      `乌鲁木齐 ${toUrumqi} 元应明显高于上海 ${toShanghai} 元`,
    );
  });

  it("价格量级符合国内航线实际（北京往返上海经济舱）", () => {
    const price = estimatePerAdultFare({
      distanceKm: routeDistance("BJS", "SHA") ?? 0,
      roundTrip: true,
      cabin: "economy",
      peakSeason: false,
      daysUntilDeparture: 21,
    });

    // 实际往返通常在 900-2000 元区间
    assert.ok(price > 800 && price < 2500, `实际 ${price} 元，应在合理区间`);
  });

  it("价格量级符合国际航线实际（北京往返东京经济舱）", () => {
    const price = estimatePerAdultFare({
      distanceKm: routeDistance("BJS", "TYO") ?? 0,
      roundTrip: true,
      cabin: "economy",
      peakSeason: false,
      daysUntilDeparture: 30,
    });

    assert.ok(price > 1800 && price < 5000, `实际 ${price} 元，应在合理区间`);
  });

  it("洲际航线价格落在实际区间（北京往返纽约 5000-7500 元）", () => {
    // 实测修正：未加洲际系数时算出约 8900 元，高于实际市场价
    const price = estimatePerAdultFare({
      distanceKm: routeDistance("BJS", "NYC") ?? 0,
      roundTrip: true,
      cabin: "economy",
      peakSeason: false,
      daysUntilDeparture: 30,
    });

    assert.ok(price > 5000 && price < 7500, `实际 ${price} 元，应在 5000-7500 区间`);
  });

  it("洲际系数只对超长航线生效，不影响短途", () => {
    const c = FARE_CONSTANTS;

    // 短途：不受洲际系数影响
    const short = estimatePerAdultFare({
      distanceKm: 1000,
      roundTrip: true,
      cabin: "economy",
      peakSeason: false,
      daysUntilDeparture: 20,
    });

    const expected = Math.round(
      baseFareForDistance(1000) * c.roundTripFactor * 1 * 1 * 1,
    );

    assert.equal(short, expected, "短途不应被洲际系数调整");
  });
});

describe("travel/fareEstimate 说明文字", () => {
  it("包含距离与人均价格", () => {
    const input = {
      distanceKm: 2100,
      roundTrip: true,
      cabin: "economy" as const,
      peakSeason: false,
      daysUntilDeparture: 20,
    };

    const text = describeFareBasis(input, estimatePerAdultFare(input));

    assert.ok(text.includes("2,100 公里"));
    assert.ok(text.includes("往返"));
  });

  it("旺季与临期会出现在说明中", () => {
    const input = {
      distanceKm: 1000,
      roundTrip: true,
      cabin: "economy" as const,
      peakSeason: true,
      daysUntilDeparture: 3,
    };

    const text = describeFareBasis(input, estimatePerAdultFare(input));

    assert.ok(text.includes("旺季"));
    assert.ok(text.includes("临期"));
  });
});

describe("travel/fareEstimate 数据完整性", () => {
  it("坐标表覆盖主要城市且格式正确", () => {
    const codes = Object.keys(CITY_COORDS);

    assert.ok(codes.length >= 100, `坐标表仅 ${codes.length} 个城市`);

    for (const [code, coord] of Object.entries(CITY_COORDS)) {
      assert.equal(code.length, 3, `${code} 不是三字码`);
      assert.equal(code, code.toUpperCase(), `${code} 应为大写`);

      const [lat, lon] = coord;

      assert.ok(lat >= -90 && lat <= 90, `${code} 纬度越界`);
      assert.ok(lon >= -180 && lon <= 180, `${code} 经度越界`);
    }
  });

  it("中国主要城市坐标正确（误差在 0.5 度内）", () => {
    const expect: Record<string, [number, number]> = {
      BJS: [39.9, 116.4],
      SHA: [31.2, 121.5],
      CAN: [23.1, 113.3],
      URC: [43.8, 87.6],
    };

    for (const [code, [lat, lon]] of Object.entries(expect)) {
      const c = coordsOf(code);

      assert.ok(c, `${code} 缺失`);
      assert.ok(Math.abs(c[0] - lat) < 0.5, `${code} 纬度偏差过大`);
      assert.ok(Math.abs(c[1] - lon) < 0.5, `${code} 经度偏差过大`);
    }
  });
});
