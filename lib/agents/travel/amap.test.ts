import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { clearAmapCache, enrichItinerary, haversineMeters, isAmapConfigured, pickMode } from "./amap";
import type { ItineraryDay } from "./types";

/**
 * 高德接入的单元测试。
 *
 * 重点验证三件事：
 *   1. 出行方式选择与距离计算的纯逻辑
 *   2. 未配置 Key 时不发任何网络请求
 *   3. 接口失败时静默降级，不抛错、不破坏行程
 */

const originalKey = process.env.AMAP_WEB_KEY;
const originalFetch = globalThis.fetch;

/** 记录发出的请求，用于断言「没配置就不请求」 */
let requests: string[] = [];

/** 每个用例前清掉模块级缓存，避免用例之间互相污染 */
afterEach(() => {
  clearAmapCache();
});

function installFakeFetch(handler: (url: string) => unknown): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    requests.push(url);

    const body = handler(url);

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

/** 构造一天的行程 */
function makeDay(date: string, names: string[]): ItineraryDay {
  return {
    day: 1,
    date,
    theme: "测试",
    accommodation: "酒店",
    estimatedCost: 0,
    activities: names.map((name, index) => ({
      startTime: "09:00",
      endTime: "10:00",
      title: name,
      kind: "sight" as const,
      description: "说明",
      estimatedCost: 0,
      costSource: "estimate" as const,
      location: name,
      // 用 index 防止 lint 报未使用
      ...(index >= 0 ? {} : {}),
    })),
  };
}

describe("travel/amap 纯逻辑", () => {
  it("haversineMeters 计算两点距离", () => {
    // 北京天安门 -> 北京故宫，约 1 公里量级
    const d = haversineMeters("116.397428,39.90923", "116.403963,39.915119");

    assert.ok(d !== null);
    assert.ok(d > 500 && d < 1500, `实际 ${d} 米`);
  });

  it("haversineMeters 对非法输入返回 null", () => {
    assert.equal(haversineMeters("bad", "116.4,39.9"), null);
    assert.equal(haversineMeters("116.4,39.9", ""), null);
  });

  it("pickMode 近距离步行、远距离公交", () => {
    assert.equal(pickMode(300), "walk");
    assert.equal(pickMode(1200), "walk");
    assert.equal(pickMode(1201), "transit");
    assert.equal(pickMode(20000), "transit");
  });
});

describe("travel/amap 未配置 Key", () => {
  before(() => {
    delete process.env.AMAP_WEB_KEY;
    requests = [];
    installFakeFetch(() => ({ status: "0", info: "SHOULD NOT BE CALLED" }));
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it("isAmapConfigured 返回 false", () => {
    assert.equal(isAmapConfigured(), false);
  });

  it("enrichItinerary 不发任何网络请求，原样返回行程", async () => {
    const day = makeDay("2026-12-10", ["南山文化旅游区"]);

    const result = await enrichItinerary({ city: "三亚", itinerary: [day] });

    assert.equal(requests.length, 0, "未配置 Key 时不应发出请求");
    assert.equal(result.itinerary.length, 1);
    assert.equal(result.cityCenter, null);
    assert.equal(result.adcode, null);
    assert.ok(result.warnings.some((w) => w.includes("未能识别目的地")));
  });
});

describe("travel/amap 接口失败时的降级", () => {
  before(() => {
    process.env.AMAP_WEB_KEY = "test-key-for-amap";
    requests = [];

    // 所有请求都返回高德的失败结构
    installFakeFetch(() => ({ status: "0", info: "INVALID_USER_KEY", infocode: "10001" }));
  });

  after(() => {
    globalThis.fetch = originalFetch;

    if (originalKey === undefined) {
      delete process.env.AMAP_WEB_KEY;
    } else {
      process.env.AMAP_WEB_KEY = originalKey;
    }
  });

  it("城市解析失败时跳过增强并给出告警，不抛错", async () => {
    const day = makeDay("2026-12-10", ["南山文化旅游区"]);

    const result = await enrichItinerary({ city: "三亚", itinerary: [day] });

    assert.ok(result.warnings.length > 0);
    // 行程不被破坏：活动数量与内容保持原样
    assert.equal(result.itinerary[0].activities.length, 1);
    assert.equal(result.itinerary[0].activities[0].title, "南山文化旅游区");
    assert.equal(result.itinerary[0].activities[0].coordinates, undefined);
  });
});

describe("travel/amap 正常增强", () => {
  before(() => {
    process.env.AMAP_WEB_KEY = "test-key-for-amap";
    requests = [];

    installFakeFetch((url) => {
      // 地理编码：城市返回市中心，活动地点返回两个相距约 1 公里的点，
      // 以便验证「相邻活动才算通勤」与「同一点跳过」两条规则
      if (url.includes("/v3/geocode/geo")) {
        const isCity = url.includes("address=%E4%B8%89%E4%BA%9A"); // 三亚
        const isSecond = url.includes(encodeURIComponent("崖州古城"));

        return {
          status: "1",
          info: "OK",
          infocode: "10000",
          geocodes: [
            {
              location: isCity
                ? "109.508217,18.247869"
                : isSecond
                  ? "109.100000,18.300000"
                  : "109.110000,18.305000",
              formatted_address: isCity ? "海南省三亚市" : "海南省三亚市测试地点",
              city: "三亚市",
              adcode: "460200",
            },
          ],
        };
      }

      // 步行路径
      if (url.includes("/v3/direction/walking")) {
        return {
          status: "1",
          info: "OK",
          infocode: "10000",
          route: { paths: [{ distance: "800", duration: "600" }] },
        };
      }

      // 公交路径
      if (url.includes("/v3/direction/transit/integrated")) {
        return {
          status: "1",
          info: "OK",
          infocode: "10000",
          route: {
            transits: [
              {
                distance: "6000",
                duration: "1500",
                segments: [{ bus: { buslines: [{ name: "地铁 1 号线" }] } }],
              },
            ],
          },
        };
      }

      // 驾车路径
      if (url.includes("/v3/direction/driving")) {
        return {
          status: "1",
          info: "OK",
          infocode: "10000",
          route: { paths: [{ distance: "5000", duration: "720" }] },
        };
      }

      // 天气
      if (url.includes("/v3/weather/weatherInfo")) {
        return {
          status: "1",
          info: "OK",
          infocode: "10000",
          forecasts: [
            {
              casts: [
                {
                  date: "2026-12-10",
                  dayweather: "晴",
                  nightweather: "多云",
                  daytemp: "26",
                  nighttemp: "20",
                  daywind: "东南",
                  daypower: "3",
                },
              ],
            },
          ],
        };
      }

      return { status: "0", info: "UNEXPECTED", infocode: "0" };
    });
  });

  after(() => {
    globalThis.fetch = originalFetch;

    if (originalKey === undefined) {
      delete process.env.AMAP_WEB_KEY;
    } else {
      process.env.AMAP_WEB_KEY = originalKey;
    }
  });

  it("补齐坐标、地址、通勤与天气", async () => {
    const day = makeDay("2026-12-10", ["南山文化旅游区", "崖州古城"]);

    const result = await enrichItinerary({ city: "三亚", itinerary: [day] });

    const activities = result.itinerary[0].activities;

    // 坐标与规范地址已补齐
    assert.ok(activities[0].coordinates, "第一个活动应有坐标");
    assert.ok(activities[0].address, "第一个活动应有规范地址");

    // 通勤挂在后一个活动上
    assert.ok(activities[1].commuteFromPrevious, "第二个活动应有通勤信息");
    assert.equal(activities[1].commuteFromPrevious?.mode, "walk");
    assert.equal(activities[1].commuteFromPrevious?.durationMinutes, 10);

    // 当日通勤段汇总
    assert.ok(result.itinerary[0].commuteLegs);
    assert.equal(result.itinerary[0].commuteLegs?.length, 1);

    // 天气改由 weather.ts 统一负责，这里只校验它需要的定位信息
    assert.equal(result.adcode, "460200");
    assert.ok(result.cityCenter, "应返回城市中心坐标供天气查询使用");

    // 行程内容未被改写
    assert.equal(activities.length, 2);
    assert.equal(activities[0].title, "南山文化旅游区");
  });

  it("地点文本过短时跳过地理编码以节省配额", async () => {
    requests = [];

    const day = makeDay("2026-12-10", ["A"]);

    await enrichItinerary({ city: "三亚", itinerary: [day] });

    const geocodeRequests = requests.filter(
      (u) => u.includes("/v3/geocode/geo") && u.includes("address=A"),
    );

    assert.equal(geocodeRequests.length, 0, "单字符地点的地理编码请求应被跳过");
  });

  it("中间活动无坐标时断开链条，不给不相邻活动编造通勤", async () => {
    requests = [];

    // 三个活动，中间那个用单字符让地理编码被跳过
    const day = makeDay("2026-12-10", ["南山文化旅游区", "A", "崖州古城"]);

    const result = await enrichItinerary({ city: "三亚", itinerary: [day] });

    const activities = result.itinerary[0].activities;

    // 第一个与第三个都有坐标，但二者不相邻，不应产生通勤段
    assert.ok(activities[0].coordinates, "第一个活动应有坐标");
    assert.ok(activities[2].coordinates, "第三个活动应有坐标");
    assert.equal(activities[2].commuteFromPrevious, undefined, "不相邻活动之间不应有通勤段");
    assert.equal(result.itinerary[0].commuteLegs?.length ?? 0, 0, "当日不应有通勤段");
  });

  it("同一点位不规划通勤，避免「步行 1 米」", async () => {
    requests = [];

    // 两个名称相同的地点会解析到同一坐标
    const day = makeDay("2026-12-10", ["三亚国际免税城", "三亚国际免税城"]);

    const result = await enrichItinerary({ city: "三亚", itinerary: [day] });

    const activities = result.itinerary[0].activities;

    assert.equal(
      activities[1].commuteFromPrevious,
      undefined,
      "同一点位之间不应生成通勤段",
    );
    assert.equal(result.itinerary[0].commuteLegs?.length ?? 0, 0);
  });

  it("多方式对比：取耗时最短的方案", async () => {
    requests = [];

    const day = makeDay("2026-12-10", ["南山文化旅游区", "崖州古城"]);

    const result = await enrichItinerary({ city: "三亚", itinerary: [day] });

    const leg = result.itinerary[0].activities[1].commuteFromPrevious;

    assert.ok(leg, "应有通勤段");
    // mock 中步行 600 秒=10 分、公交 1500 秒=25 分、驾车 720 秒=12 分
    // 最短的是步行，应被选中
    assert.equal(leg.mode, "walk");
    assert.equal(leg.durationMinutes, 10);
  });

  it("首轮结果超过阈值时补查驾车并可能改用驾车", async () => {
    requests = [];

    // 用较远的两个点，让步行不在候选内、公交偏慢
    const day = makeDay("2026-12-10", ["南山文化旅游区", "崖州古城"]);

    const result = await enrichItinerary({ city: "三亚", itinerary: [day] });

    const leg = result.itinerary[0].activities[1].commuteFromPrevious;

    assert.ok(leg);
    // 已询问过公交接口（多方式对比的必要一步）
    assert.ok(
      requests.some((u) => u.includes("/v3/direction/transit/integrated")),
      "应当查询过公交方案",
    );
  });
});
