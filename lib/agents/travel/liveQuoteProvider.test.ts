import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { createLiveQuoteProvider, pickHotel, toFlightQuote, toHotelQuote } from "./liveQuoteProvider";
import type { QuoteContext } from "./providers";
import type { RollingGoHotel } from "./rollinggo";
import type { VariflightFlight } from "./variflight";

/**
 * 组合 Provider 测试。
 *
 * 覆盖重点：各项独立降级 —— 机票失败不影响酒店，反之亦然；
 * 以及时区处理（飞常准返回的时间戳必须按北京时间显示）。
 */

const ORIGINAL = {
  vf: process.env.VARIFLIGHT_API_KEY,
  rg: process.env.ROLLINGGO_API_KEY,
};

afterEach(() => {
  if (ORIGINAL.vf === undefined) delete process.env.VARIFLIGHT_API_KEY;
  else process.env.VARIFLIGHT_API_KEY = ORIGINAL.vf;

  if (ORIGINAL.rg === undefined) delete process.env.ROLLINGGO_API_KEY;
  else process.env.ROLLINGGO_API_KEY = ORIGINAL.rg;
});

function makeContext(over: Partial<QuoteContext> = {}): QuoteContext {
  return {
    originCity: "北京",
    destinationCity: "上海",
    originCode: "BJS",
    destinationCode: "SHA",
    departDate: "2026-10-29",
    returnDate: "2026-11-01",
    nights: 3,
    party: { adults: 2, children: 0 },
    style: "comfort",
    rooms: 1,
    peakSeason: false,
    ...over,
  };
}

function makeFlight(over: Partial<VariflightFlight> = {}): VariflightFlight {
  return {
    flightNumber: "KN5977",
    airline: "KN",
    depAirport: "北京大兴",
    arrAirport: "上海浦东",
    depCode: "PKX",
    arrCode: "PVG",
    // 北京时间 2026-10-29 20:45 对应的时间戳
    departAt: Date.parse("2026-10-29T20:45:00+08:00"),
    arriveAt: Date.parse("2026-10-29T22:55:00+08:00"),
    distance: 1178,
    hasStop: false,
    cabins: [],
    ...over,
  };
}

function makeHotel(over: Partial<RollingGoHotel> = {}): RollingGoHotel {
  return {
    hotelId: 1,
    name: "测试酒店",
    brand: "Test",
    address: "某路 1 号",
    starRating: 4,
    pricePerNight: 390,
    currency: "CNY",
    bookingUrl: "https://book.example/1",
    latitude: null,
    longitude: null,
    amenities: [],
    ...over,
  };
}

describe("travel/liveQuoteProvider 航段时区", () => {
  it("起飞时间按北京时间显示（回归：曾用 toISOString 得到 UTC）", () => {
    const quote = toFlightQuote(makeFlight(), 350, makeContext());
    const leg = quote.outbound[0];

    // 北京时间 20:45 起飞
    assert.ok(
      leg.departAt.includes("T20:45"),
      `去程应为 20:45（北京时间），实际 ${leg.departAt}`,
    );
  });

  it("来源说明里的起飞时间与航段一致", () => {
    const quote = toFlightQuote(makeFlight(), 350, makeContext());

    assert.ok(quote.note.includes("20:45"), `说明应含 20:45，实际：${quote.note}`);
  });
});

describe("travel/liveQuoteProvider 机票转换", () => {
  it("往返人均 = 单程 × 2", () => {
    const quote = toFlightQuote(makeFlight(), 350, makeContext());

    assert.equal(quote.pricePerAdult, 700);
  });

  it("总价按人数折算（儿童 75%）", () => {
    const quote = toFlightQuote(
      makeFlight(),
      350,
      makeContext({ party: { adults: 2, children: 1 } }),
    );

    // 700 × 2 + 700 × 0.75 × 1 = 1400 + 525 = 1925
    assert.equal(quote.totalPrice, 1925);
  });

  it("置信度为 live，提供方为 variflight", () => {
    const quote = toFlightQuote(makeFlight(), 350, makeContext());

    assert.equal(quote.confidence, "live");
    assert.equal(quote.provider, "variflight");
  });

  it("经停航班标记为 1 次经停", () => {
    assert.equal(toFlightQuote(makeFlight({ hasStop: true }), 350, makeContext()).stops, 1);
    assert.equal(toFlightQuote(makeFlight({ hasStop: false }), 350, makeContext()).stops, 0);
  });

  it("无时间戳时回退到出发日期", () => {
    const quote = toFlightQuote(
      makeFlight({ departAt: null, arriveAt: null }),
      350,
      makeContext(),
    );

    assert.ok(quote.outbound[0].departAt.startsWith("2026-10-29"));
  });
});

describe("travel/liveQuoteProvider 酒店转换", () => {
  it("按房间数折算每晚价格", () => {
    const quote = toHotelQuote(makeHotel(), makeContext({ rooms: 2, nights: 3 }), "三至四星酒店");

    assert.equal(quote.pricePerNight, 780);
    assert.equal(quote.totalPrice, 2340);
  });

  it("酒店选择：经济型取最低价", () => {
    const hotels = [
      makeHotel({ hotelId: 1, pricePerNight: 800, starRating: 5 }),
      makeHotel({ hotelId: 2, pricePerNight: 200, starRating: 3 }),
    ];

    assert.equal(pickHotel(hotels, "budget")?.hotelId, 2);
  });
});

describe("travel/liveQuoteProvider 独立降级", () => {
  it("两个 Key 都未配置时全部走估算，且不发请求", async () => {
    delete process.env.VARIFLIGHT_API_KEY;
    delete process.env.ROLLINGGO_API_KEY;

    const originalFetch = globalThis.fetch;
    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      throw new Error("不应发起请求");
    }) as typeof fetch;

    try {
      const quotes = await createLiveQuoteProvider().fetchQuotes(makeContext());

      assert.equal(called, 0, "未配置任何 Key 时不应发出请求");
      assert.equal(quotes.flight?.confidence, "estimate");
      assert.equal(quotes.hotel?.confidence, "estimate");
      assert.ok(quotes.warnings.some((w) => w.includes("VARIFLIGHT_API_KEY")));
      assert.ok(quotes.warnings.some((w) => w.includes("ROLLINGGO_API_KEY")));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("只配了飞常准：机票实时、酒店估算", async () => {
    process.env.VARIFLIGHT_API_KEY = "sk_test";
    delete process.env.ROLLINGGO_API_KEY;

    const originalFetch = globalThis.fetch;

    const flightPayload = JSON.stringify({
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text:
              "{'code': 200, 'message': 'Success', 'data': [{'flightcompany': 'KN', " +
              "'flightno': 'KN5977', 'flightdepcode': 'PKX', 'flightarrcode': 'PVG', " +
              "'depaptcname': '北京大兴', 'arraptcname': '上海浦东', " +
              "'flightdeptimeplandate': 1793281500, 'flightarrtimeplandate': 1793289300, " +
              "'distance': 1178, 'stopflag': 0, 'cabins': [{'cabinclass': 'Y', " +
              "'classname': '经济舱', 'cabincode': 'T', 'price': 350, 'stprice': 2150}]}]}",
          },
        ],
      },
      id: 1,
    });

    globalThis.fetch = (async () =>
      new Response(flightPayload, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const quotes = await createLiveQuoteProvider().fetchQuotes(makeContext());

      assert.equal(quotes.flight?.confidence, "live");
      assert.equal(quotes.flight?.provider, "variflight");
      assert.equal(quotes.hotel?.confidence, "estimate");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("只配了 RollingGo：酒店实时、机票估算", async () => {
    delete process.env.VARIFLIGHT_API_KEY;
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    const hotelPayload = JSON.stringify({
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              code: 2000,
              hotelInformationList: [
                {
                  hotelId: 1,
                  name: "测试酒店",
                  starRating: 4,
                  address: "某路",
                  price: { hasPrice: true, currency: "CNY", lowestPrice: 390 },
                  bookingUrl: "https://book.example/1",
                },
              ],
            }),
          },
        ],
      },
      id: 1,
    });

    globalThis.fetch = (async () =>
      new Response(hotelPayload, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const quotes = await createLiveQuoteProvider().fetchQuotes(makeContext());

      assert.equal(quotes.hotel?.confidence, "live");
      assert.equal(quotes.hotel?.provider, "rollinggo");
      assert.equal(quotes.flight?.confidence, "estimate");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("飞常准报错时回退，但酒店仍为实时（互不影响）", async () => {
    process.env.VARIFLIGHT_API_KEY = "sk_test";
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);

      // 飞常准端返回 500，RollingGo 端返回正常数据
      if (url.includes("variflight")) {
        return new Response("error", { status: 500 });
      }

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  code: 2000,
                  hotelInformationList: [
                    {
                      hotelId: 1,
                      name: "测试酒店",
                      starRating: 4,
                      address: "某路",
                      price: { hasPrice: true, currency: "CNY", lowestPrice: 390 },
                      bookingUrl: "https://book.example/1",
                    },
                  ],
                }),
              },
            ],
          },
          id: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const quotes = await createLiveQuoteProvider().fetchQuotes(makeContext());

      assert.equal(quotes.flight?.confidence, "estimate", "机票应回退");
      assert.equal(quotes.hotel?.confidence, "live", "酒店不应受机票失败影响");
      assert.ok(quotes.warnings.some((w) => w.includes("飞常准机票查询失败")));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("天数为 0 时不查酒店", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;
    const urls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      const quotes = await createLiveQuoteProvider().fetchQuotes(makeContext({ nights: 0 }));

      assert.equal(quotes.hotel, null);
      assert.equal(urls.length, 0, "0 晚时不应发起酒店查询");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
