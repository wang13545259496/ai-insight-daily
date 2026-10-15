import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isRollingGoConfigured } from "./rollinggo";
import { pickHotel, toHotelQuote } from "./rollinggoProvider";
import type { RollingGoHotel } from "./rollinggo";
import type { QuoteContext } from "./providers";

/**
 * RollingGo 接入测试。
 *
 * 重点覆盖降级路径：报价接口是按次计费的商务资源，
 * 未配置凭据时绝不能发请求；接口失败时必须回退而不是抛错。
 */

const ORIGINAL_KEY = process.env.ROLLINGGO_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.ROLLINGGO_API_KEY;
  } else {
    process.env.ROLLINGGO_API_KEY = ORIGINAL_KEY;
  }
});

function makeHotel(over: Partial<RollingGoHotel> = {}): RollingGoHotel {
  return {
    hotelId: 1,
    name: "测试酒店",
    brand: "Test",
    address: "测试地址",
    starRating: 4,
    pricePerNight: 400,
    currency: "CNY",
    bookingUrl: "https://example.com/book",
    latitude: null,
    longitude: null,
    amenities: [],
    ...over,
  };
}

function makeContext(over: Partial<QuoteContext> = {}): QuoteContext {
  return {
    originCity: "北京",
    destinationCity: "上海",
    originCode: "BJS",
    destinationCode: "SHA",
    departDate: "2026-11-01",
    returnDate: "2026-11-04",
    nights: 3,
    party: { adults: 2, children: 0 },
    style: "comfort",
    rooms: 1,
    peakSeason: false,
    ...over,
  };
}

describe("travel/rollinggo 配置检查", () => {
  it("未配置 Key 时返回 false", () => {
    delete process.env.ROLLINGGO_API_KEY;
    assert.equal(isRollingGoConfigured(), false);
  });

  it("配置 Key 后返回 true", () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";
    assert.equal(isRollingGoConfigured(), true);
  });

  it("空白 Key 视为未配置", () => {
    process.env.ROLLINGGO_API_KEY = "   ";
    assert.equal(isRollingGoConfigured(), false);
  });
});

describe("travel/rollinggoProvider 酒店选择", () => {
  it("经济型选最便宜的", () => {
    const hotels = [
      makeHotel({ hotelId: 1, pricePerNight: 800, starRating: 5 }),
      makeHotel({ hotelId: 2, pricePerNight: 200, starRating: 3 }),
      makeHotel({ hotelId: 3, pricePerNight: 500, starRating: 4 }),
    ];

    assert.equal(pickHotel(hotels, "budget")?.hotelId, 2);
  });

  it("品质型优先星级，同星级取低价", () => {
    const hotels = [
      makeHotel({ hotelId: 1, pricePerNight: 800, starRating: 4 }),
      makeHotel({ hotelId: 2, pricePerNight: 1200, starRating: 5 }),
      makeHotel({ hotelId: 3, pricePerNight: 900, starRating: 5 }),
    ];

    // 两家 5 星中取便宜的（900）
    assert.equal(pickHotel(hotels, "premium")?.hotelId, 3);
  });

  it("跳过无报价的酒店", () => {
    const hotels = [
      makeHotel({ hotelId: 1, pricePerNight: null }),
      makeHotel({ hotelId: 2, pricePerNight: 300 }),
    ];

    assert.equal(pickHotel(hotels, "comfort")?.hotelId, 2);
  });

  it("全部无报价时仍返回第一家（至少给出酒店名）", () => {
    const hotels = [
      makeHotel({ hotelId: 1, pricePerNight: null }),
      makeHotel({ hotelId: 2, pricePerNight: null }),
    ];

    assert.equal(pickHotel(hotels, "comfort")?.hotelId, 1);
  });

  it("空列表返回 null", () => {
    assert.equal(pickHotel([], "comfort"), null);
  });
});

describe("travel/rollinggoProvider 报价转换", () => {
  it("置信度标记为 live，并按房间数折算", () => {
    const hotel = makeHotel({ pricePerNight: 400 });
    const quote = toHotelQuote(hotel, makeContext({ rooms: 2, nights: 3 }), "三至四星酒店");

    assert.equal(quote.confidence, "live");
    assert.equal(quote.provider, "rollinggo");
    // 400 × 2 间 = 800/晚
    assert.equal(quote.pricePerNight, 800);
    // 800 × 3 晚 = 2400
    assert.equal(quote.totalPrice, 2400);
    assert.equal(quote.rooms, 2);
  });

  it("来源说明包含酒店名与预订链接", () => {
    const quote = toHotelQuote(
      makeHotel({ name: "上海某酒店", bookingUrl: "https://book.example/x" }),
      makeContext(),
      "三至四星酒店",
    );

    assert.ok(quote.note.includes("上海某酒店"));
    assert.ok(quote.note.includes("https://book.example/x"));
    assert.ok(quote.note.includes("三至四星"));
  });

  it("无价格时按 0 计，不抛错", () => {
    const quote = toHotelQuote(makeHotel({ pricePerNight: null }), makeContext(), "说明");

    assert.equal(quote.pricePerNight, 0);
    assert.equal(quote.totalPrice, 0);
  });

  it("星级为 0 时 rating 记为 null（未知而非零星）", () => {
    const quote = toHotelQuote(makeHotel({ starRating: 0 }), makeContext(), "说明");

    assert.equal(quote.rating, null);
  });
});

describe("travel/rollinggoProvider 降级路径", () => {
  it("未配置 Key 时返回估算且不发起请求", async () => {
    delete process.env.ROLLINGGO_API_KEY;

    // 拦截 fetch，任何调用都应导致测试失败
    const originalFetch = globalThis.fetch;
    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      throw new Error("不应发起网络请求");
    }) as typeof fetch;

    try {
      const { createRollingGoProvider } = await import("./rollinggoProvider");
      const provider = createRollingGoProvider();

      assert.equal(provider.supportsLiveQuotes(), false);

      const quotes = await provider.fetchQuotes(makeContext());

      assert.equal(called, 0, "未配置 Key 时不应发出任何请求");
      assert.equal(quotes.hotel?.confidence, "estimate");
      assert.ok(quotes.warnings.some((w) => w.includes("ROLLINGGO_API_KEY")));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("接口报错时回退为估算并给出告警", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response("upstream error", { status: 500 })) as typeof fetch;

    try {
      const { createRollingGoProvider } = await import("./rollinggoProvider");
      const quotes = await createRollingGoProvider().fetchQuotes(makeContext());

      assert.equal(quotes.hotel?.confidence, "estimate", "接口失败应回退为估算");
      assert.ok(
        quotes.warnings.some((w) => w.includes("RollingGo 酒店查询失败")),
        "应给出可读的失败告警",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("接口返回空列表时回退为估算", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    const emptyResult = JSON.stringify({
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              code: 2000,
              message: "ok",
              hotelInformationList: [],
            }),
          },
        ],
      },
      id: 1,
    });

    globalThis.fetch = (async () =>
      new Response(emptyResult, { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    try {
      const { createRollingGoProvider } = await import("./rollinggoProvider");
      const quotes = await createRollingGoProvider().fetchQuotes(makeContext());

      assert.equal(quotes.hotel?.confidence, "estimate");
      assert.ok(quotes.warnings.some((w) => w.includes("未返回符合条件的酒店")));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("成功时酒店为 live，机票仍为估算", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    const payload = JSON.stringify({
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              code: 2000,
              message: "酒店搜索成功",
              hotelInformationList: [
                {
                  hotelId: 1100060,
                  name: "测试酒店",
                  brand: "Test",
                  address: "某路 1 号",
                  starRating: 4,
                  price: { hasPrice: true, currency: "CNY", lowestPrice: 388.5 },
                  bookingUrl: "https://book.example/1100060",
                  hotelAmenities: ["免费WiFi", "健身房"],
                },
              ],
            }),
          },
        ],
      },
      id: 1,
    });

    globalThis.fetch = (async () =>
      new Response(payload, { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    try {
      const { createRollingGoProvider } = await import("./rollinggoProvider");
      const quotes = await createRollingGoProvider().fetchQuotes(makeContext());

      assert.equal(quotes.hotel?.confidence, "live");
      assert.equal(quotes.hotel?.name, "测试酒店");
      assert.equal(quotes.hotel?.rating, 4);
      assert.equal(quotes.hotel?.pricePerNight, 389); // 388.5 取整

      // 机票：RollingGo 无机票端点，保持估算
      assert.equal(quotes.flight?.confidence, "estimate");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
