import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CHILD_FLIGHT_RATIO,
  createEstimateProvider,
  emptyQuotes,
  estimateFlightQuote,
  estimateHotelQuote,
  formatDuration,
  legsDurationMinutes,
  resolveRoomCount,
  totalFlightPrice,
  type QuoteContext,
} from "./providers";

/** 构造询价上下文 */
function makeContext(overrides: Partial<QuoteContext> = {}): QuoteContext {
  return {
    originCity: "北京",
    destinationCity: "东京",
    originCode: "BJS",
    destinationCode: "TYO",
    departDate: "2026-10-01",
    returnDate: "2026-10-05",
    nights: 4,
    party: { adults: 2, children: 0 },
    style: "comfort",
    rooms: 1,
    peakSeason: false,
    ...overrides,
  };
}

describe("travel/providers 工具函数", () => {
  it("时长格式化", () => {
    assert.equal(formatDuration(0), "0分");
    assert.equal(formatDuration(45), "45分");
    assert.equal(formatDuration(120), "2小时");
    assert.equal(formatDuration(510), "8小时30分");
  });

  it("航段耗时按真实时间差累加，忽略经停", () => {
    const minutes = legsDurationMinutes([
      { from: "PEK", to: "NRT", departAt: "2026-10-01T08:00:00", arriveAt: "2026-10-01T12:00:00", carrier: "CA", flightNumber: "CA1" },
      { from: "NRT", to: "PEK", departAt: "2026-10-05T14:00:00", arriveAt: "2026-10-05T18:30:00", carrier: "CA", flightNumber: "CA2" },
    ]);

    assert.equal(minutes, 240 + 270);
  });

  it("时间非法时不参与累加", () => {
    const minutes = legsDurationMinutes([
      { from: "A", to: "B", departAt: "坏数据", arriveAt: "也坏", carrier: "X", flightNumber: "X1" },
    ]);

    assert.equal(minutes, 0);
  });

  it("儿童票价按 75 折算", () => {
    assert.equal(CHILD_FLIGHT_RATIO, 0.75);
    assert.equal(totalFlightPrice(1000, { adults: 2, children: 0 }), 2000);
    assert.equal(totalFlightPrice(1000, { adults: 2, children: 2 }), 3500);
  });

  it("房间数按每间最多 3 人计算", () => {
    assert.equal(resolveRoomCount({ adults: 1, children: 0 }), 1);
    assert.equal(resolveRoomCount({ adults: 2, children: 0 }), 1);
    assert.equal(resolveRoomCount({ adults: 3, children: 0 }), 1);
    assert.equal(resolveRoomCount({ adults: 3, children: 1 }), 2);
    assert.equal(resolveRoomCount({ adults: 4, children: 2 }), 2);
    assert.equal(resolveRoomCount({ adults: 0, children: 0 }), 0);
  });

  it("空报价结果只带告警", () => {
    const quotes = emptyQuotes(["出错了"]);

    assert.equal(quotes.flight, null);
    assert.equal(quotes.hotel, null);
    assert.deepEqual(quotes.warnings, ["出错了"]);
  });
});

describe("travel/providers 估算报价", () => {
  it("估算机票标注为 estimate 且价格随人数变化", () => {
    const quote = estimateFlightQuote(makeContext());

    assert.equal(quote.confidence, "estimate");
    assert.equal(quote.provider, "heuristic");
    assert.equal(quote.currency, "CNY");
    assert.equal(quote.totalPrice, totalFlightPrice(quote.pricePerAdult, { adults: 2, children: 0 }));
    assert.ok(quote.pricePerAdult > 0);
  });

  it("旺季估算价格高于淡季", () => {
    const normal = estimateFlightQuote(makeContext());
    const peak = estimateFlightQuote(makeContext({ peakSeason: true }));

    assert.ok(peak.pricePerAdult > normal.pricePerAdult);
  });

  it("档位越高估算价格越高", () => {
    const budget = estimateFlightQuote(makeContext({ style: "budget" }));
    const luxury = estimateFlightQuote(makeContext({ style: "luxury" }));

    assert.ok(luxury.pricePerAdult > budget.pricePerAdult);
  });

  it("估算住宿按房间数与晚数计算总价", () => {
    const quote = estimateHotelQuote(makeContext({ rooms: 2, nights: 4 }));

    assert.equal(quote.confidence, "estimate");
    assert.equal(quote.rooms, 2);
    assert.equal(quote.totalPrice, quote.pricePerNight * 4);
  });

  it("一日游估算住宿总价为 0", () => {
    const quote = estimateHotelQuote(makeContext({ nights: 0 }));

    assert.equal(quote.totalPrice, 0);
  });
});

describe("travel/providers 估算 Provider", () => {
  it("不支持实时询价", () => {
    assert.equal(createEstimateProvider().supportsLiveQuotes(), false);
  });

  it("返回机票与住宿并标注为估算模式", async () => {
    const provider = createEstimateProvider();
    const quotes = await provider.fetchQuotes(makeContext());

    assert.ok(quotes.flight);
    assert.ok(quotes.hotel);
    assert.equal(quotes.flight.confidence, "estimate");
    assert.ok(quotes.warnings.some((item) => item.includes("估算模式")));
  });

  it("一日游不返回住宿", async () => {
    const provider = createEstimateProvider();
    const quotes = await provider.fetchQuotes(makeContext({ nights: 0 }));

    assert.equal(quotes.hotel, null);
  });

  it("外部传入的告警被保留", async () => {
    const provider = createEstimateProvider(["未配置凭据"]);
    const quotes = await provider.fetchQuotes(makeContext());

    assert.ok(quotes.warnings.some((item) => item.includes("未配置凭据")));
  });
});
