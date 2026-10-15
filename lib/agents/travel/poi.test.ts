import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { countWithCost, describePoisForPrompt, fetchDestinationPois } from "./poi";
import type { PoiItem, PoiSearchResult } from "./poi";

/**
 * POI 检索测试。
 *
 * 这段逻辑解决的是「模型凭训练知识编地名」的问题：
 * 把高德检索到的真实景点与餐厅作为候选喂给模型。
 */

const ORIGINAL_KEY = process.env.AMAP_WEB_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.AMAP_WEB_KEY;
  else process.env.AMAP_WEB_KEY = ORIGINAL_KEY;
});

function makePoi(over: Partial<PoiItem> = {}): PoiItem {
  return {
    id: "B00001",
    name: "西湖",
    type: "风景名胜;公园广场",
    address: "西湖区龙井路1号",
    location: "120.140,30.250",
    cost: null,
    rating: 4.9,
    district: "西湖区",
    ...over,
  };
}

describe("travel/poi 提示词格式化", () => {
  it("景点与餐厅分节列出", () => {
    const result: PoiSearchResult = {
      sights: [makePoi({ name: "西湖", cost: null, rating: 4.9 })],
      restaurants: [makePoi({ name: "楼外楼", cost: 180, rating: 4.6 })],
      warnings: [],
    };

    const text = describePoisForPrompt(result);

    assert.ok(text.includes("可选景点"));
    assert.ok(text.includes("西湖"));
    assert.ok(text.includes("可选餐厅"));
    assert.ok(text.includes("楼外楼"));
  });

  it("★ 景点无票价时标注「票价未知」，不写成 0 元", () => {
    const result: PoiSearchResult = {
      sights: [makePoi({ cost: null })],
      restaurants: [],
      warnings: [],
    };

    const text = describePoisForPrompt(result);

    assert.ok(text.includes("票价未知"), `实际：${text}`);
    assert.ok(!text.includes("0 元"), "不应把缺失的票价写成 0 元");
  });

  it("餐厅带人均消费", () => {
    const result: PoiSearchResult = {
      sights: [],
      restaurants: [makePoi({ name: "楼外楼", cost: 180 })],
      warnings: [],
    };

    assert.ok(describePoisForPrompt(result).includes("人均 180 元"));
  });

  it("无评分时标注「无评分」", () => {
    const result: PoiSearchResult = {
      sights: [makePoi({ rating: null })],
      restaurants: [],
      warnings: [],
    };

    assert.ok(describePoisForPrompt(result).includes("无评分"));
  });

  it("空结果返回空串", () => {
    assert.equal(
      describePoisForPrompt({ sights: [], restaurants: [], warnings: [] }),
      "",
    );
  });

  it("统计有价格信息的条目数", () => {
    const items = [
      makePoi({ id: "1", cost: 50 }),
      makePoi({ id: "2", cost: null }),
      makePoi({ id: "3", cost: 120 }),
    ];

    assert.equal(countWithCost(items), 2);
  });
});

describe("travel/poi 降级路径", () => {
  it("未配置 Key 时返回空且不发请求", async () => {
    delete process.env.AMAP_WEB_KEY;

    const originalFetch = globalThis.fetch;
    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      throw new Error("不应发起请求");
    }) as typeof fetch;

    try {
      const result = await fetchDestinationPois("杭州");

      assert.equal(called, 0, "未配置 Key 时不应发请求");
      assert.equal(result.sights.length, 0);
      assert.equal(result.restaurants.length, 0);
      assert.ok(result.warnings.some((w) => w.includes("AMAP_WEB_KEY")));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("接口报错时返回空并给出告警", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "0", info: "INVALID_USER_KEY" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const result = await fetchDestinationPois("杭州");

      assert.equal(result.sights.length, 0);
      // 接口返回 status=0 时 amapGet 会抛错，因此应有告警
      assert.ok(result.warnings.length > 0, "应有告警");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("解析正常结果并按两类分开", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const originalFetch = globalThis.fetch;

    const sightsPayload = JSON.stringify({
      status: "1",
      pois: [
        {
          id: "B1",
          name: "西湖",
          type: "风景名胜",
          address: "龙井路",
          location: "120.14,30.25",
          adname: "西湖区",
          biz_ext: { rating: "4.9" },
        },
      ],
    });

    const restaurantsPayload = JSON.stringify({
      status: "1",
      pois: [
        {
          id: "B2",
          name: "楼外楼",
          type: "餐饮服务",
          address: "孤山路",
          location: "120.14,30.25",
          adname: "西湖区",
          biz_ext: { cost: "180", rating: "4.6" },
        },
      ],
    });

    // 每次检索会发两个请求（weight 与 rating），按关键字区分返回内容
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("050000") ? restaurantsPayload : sightsPayload;

      return new Response(payload, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const result = await fetchDestinationPois("杭州");

      assert.equal(result.sights.length, 1);
      assert.equal(result.sights[0].name, "西湖");
      assert.equal(result.sights[0].rating, 4.9);
      assert.equal(result.restaurants.length, 1);
      assert.equal(result.restaurants[0].name, "楼外楼");
      assert.equal(result.restaurants[0].cost, 180);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("biz_ext 为空数组时不报错（接口的另一种返回形态）", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: "1",
          pois: [
            {
              id: "B1",
              name: "某公园",
              type: "风景名胜",
              location: "120.1,30.1",
              adname: "某区",
              biz_ext: [],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    try {
      const result = await fetchDestinationPois("杭州");

      assert.equal(result.sights.length, 1);
      assert.equal(result.sights[0].cost, null);
      assert.equal(result.sights[0].rating, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
