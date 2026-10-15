import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { fetchHotelDetail } from "./rollinggo";

/**
 * 酒店房型明细（getHotelDetail）测试。
 *
 * 这段逻辑用于「用户选定酒店后的二次查价」：搜索接口只给最低价，
 * 而用户决定预订前需要知道有哪些房型、含不含早、能否免费取消。
 */

const ORIGINAL_KEY = process.env.ROLLINGGO_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ROLLINGGO_API_KEY;
  else process.env.ROLLINGGO_API_KEY = ORIGINAL_KEY;
});

/**
 * 构造 MCP 响应。
 *
 * 字段名按**实测**结构：房型数组在顶层的 roomRatePlans，
 * 不在 data.roomList —— 这一点与参数 schema 的推测不同，
 * 曾因此让 rooms 恒为空。
 */
function mcpResponse(roomList: unknown[]) {
  return JSON.stringify({
    jsonrpc: "2.0",
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            hotelId: 2173126,
            name: "测试酒店",
            starRating: 4,
            checkIn: "2026-11-01",
            checkOut: "2026-11-04",
            roomRatePlans: roomList,
            code: 2000,
            message: "搜索成功",
          }),
        },
      ],
    },
    id: 1,
  });
}

/** 一个房型记录（字段名与接口实测一致） */
function room(over: Record<string, unknown> = {}) {
  return {
    roomName: "高级大床房",
    ratePlanId: "abc123",
    averagePrice: 420,
    bedTypeDescription: "1 大床",
    currency: "CNY",
    mealAmount: 2,
    mealTypeStr: "含早餐",
    cancelPolicy: "免费取消截止至酒店当地时间 2026-10-28 18:00:00",
    cancelable: true,
    roomInfo: {
      hasWifi: true,
      hasWindow: true,
      maxOccupancy: 2,
      size: "22",
      floor: "6-7",
      smoking: "不可吸烟",
    },
    ...over,
  };
}

describe("travel/rollinggo 房型明细", () => {
  it("未配置 Key 时不发请求", async () => {
    delete process.env.ROLLINGGO_API_KEY;

    const originalFetch = globalThis.fetch;
    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      throw new Error("不应发起请求");
    }) as typeof fetch;

    try {
      const result = await fetchHotelDetail(123, "2026-11-01", "2026-11-04");

      assert.equal(called, 0);
      assert.equal(result.rooms.length, 0);
      assert.ok(result.error?.includes("ROLLINGGO_API_KEY"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("酒店 ID 无效时返回错误", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const result = await fetchHotelDetail(0, "2026-11-01", "2026-11-04");

    assert.equal(result.rooms.length, 0);
    assert.ok(result.error?.includes("无效"));
  });

  it("★ 解析房型并按价格升序排列", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        mcpResponse([
          room({ roomName: "贵房", averagePrice: 900 }),
          room({ roomName: "便宜房", averagePrice: 300 }),
          room({ roomName: "中间房", averagePrice: 500 }),
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    try {
      const result = await fetchHotelDetail(123, "2026-11-01", "2026-11-04");

      assert.equal(result.error, null);
      assert.equal(result.rooms.length, 3);
      assert.equal(result.rooms[0].roomName, "便宜房");
      assert.equal(result.rooms[2].roomName, "贵房");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("提取房型的关键字段（床型/早餐/退改/面积）", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(mcpResponse([room()]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const result = await fetchHotelDetail(123, "2026-11-01", "2026-11-04");
      const r = result.rooms[0];

      assert.equal(r.averagePrice, 420);
      assert.equal(r.bedType, "1 大床");
      assert.equal(r.meal, "含早餐");
      assert.equal(r.cancelable, true);
      assert.equal(r.size, "22");
      assert.equal(r.maxOccupancy, 2);
      assert.ok(r.cancelPolicy.includes("免费取消"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("价格非正的房型被过滤", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        mcpResponse([
          room({ roomName: "无价房", averagePrice: 0 }),
          room({ roomName: "有价房", averagePrice: 400 }),
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    try {
      const result = await fetchHotelDetail(123, "2026-11-01", "2026-11-04");

      assert.equal(result.rooms.length, 1);
      assert.equal(result.rooms[0].roomName, "有价房");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("尊重 limit 上限", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    const many = Array.from({ length: 10 }, (_, i) =>
      room({ roomName: `房型${i}`, averagePrice: 300 + i * 10 }),
    );

    globalThis.fetch = (async () =>
      new Response(mcpResponse(many), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const result = await fetchHotelDetail(123, "2026-11-01", "2026-11-04", 2, 3);

      assert.equal(result.rooms.length, 3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("roomList 为空时返回空数组且无错误", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(mcpResponse([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const result = await fetchHotelDetail(123, "2026-11-01", "2026-11-04");

      assert.equal(result.rooms.length, 0);
      assert.equal(result.error, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("接口返回 HTTP 错误时给出错误信息", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response("server error", { status: 500 })) as typeof fetch;

    try {
      const result = await fetchHotelDetail(123, "2026-11-01", "2026-11-04");

      assert.equal(result.rooms.length, 0);
      assert.ok(result.error?.includes("500"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("响应无法解析时给出错误（不抛异常）", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response("not json at all", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const result = await fetchHotelDetail(123, "2026-11-01", "2026-11-04");

      assert.equal(result.rooms.length, 0);
      assert.ok(result.error);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("roomInfo 缺失时字段降级为默认值", async () => {
    process.env.ROLLINGGO_API_KEY = "mcp_test";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        mcpResponse([{ roomName: "简房", averagePrice: 300, roomInfo: [] }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    try {
      const result = await fetchHotelDetail(123, "2026-11-01", "2026-11-04");
      const r = result.rooms[0];

      assert.equal(r.averagePrice, 300);
      assert.equal(r.size, "");
      assert.equal(r.maxOccupancy, null);
      assert.equal(r.cancelable, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
