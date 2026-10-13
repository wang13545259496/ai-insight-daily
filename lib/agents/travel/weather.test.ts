import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { fetchTravelWeather, isQWeatherConfigured, mapQWeatherDays } from "./weather";

/**
 * 天气模块测试。
 *
 * 覆盖三件事：
 *   1. 和风天气 v1 字段映射（含 UTC/本地时间、缺失字段的容错）
 *   2. 和风优先、高德兜底的降级顺序
 *   3. 缺 QWEATHER_HOST 时给出可执行的提示，而不是笼统报错
 */

const savedKey = process.env.QWEATHER_KEY;
const savedHost = process.env.QWEATHER_HOST;
const savedAmap = process.env.AMAP_WEB_KEY;

const originalFetch = globalThis.fetch;

let requests: string[] = [];

function installFakeFetch(handler: (url: string) => { status?: number; body: unknown }): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    requests.push(url);

    const { status = 200, body } = handler(url);

    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

/** 构造一条和风天气 v1 的每日预报 */
function qweatherDay(date: string): Record<string, unknown> {
  return {
    forecastStartTime: `${date}T16:00Z`,
    temperatureMax: { value: 29.94, unit: "°C" },
    temperatureMin: { value: 20.93, unit: "°C" },
    daytime: {
      condition: { text: "小雨", code: "305" },
      wind: { direction: { degree: 270, compass: "w" }, scale: 2 },
    },
    nighttime: { condition: { text: "多云", code: "101" } },
  };
}

function restoreEnv(): void {
  for (const [name, value] of [
    ["QWEATHER_KEY", savedKey],
    ["QWEATHER_HOST", savedHost],
    ["AMAP_WEB_KEY", savedAmap],
  ] as const) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

describe("travel/weather 字段映射", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("isQWeatherConfigured 随环境变量变化", () => {
    delete process.env.QWEATHER_KEY;
    assert.equal(isQWeatherConfigured(), false);

    process.env.QWEATHER_KEY = "test-key";
    assert.equal(isQWeatherConfigured(), true);
  });

  it("把和风天气字段转成内部结构", () => {
    const days = mapQWeatherDays([qweatherDay("2026-12-10")]);

    assert.equal(days.length, 1);
    assert.equal(days[0].date, "2026-12-10");
    assert.equal(days[0].dayWeather, "小雨");
    assert.equal(days[0].nightWeather, "多云");
    assert.equal(days[0].dayTemp, "30");
    assert.equal(days[0].nightTemp, "21");
    assert.equal(days[0].windDirection, "西");
    assert.equal(days[0].windPower, "2");
  });

  it("缺少日期或字段异常时跳过该天而不是报错", () => {
    const days = mapQWeatherDays([
      { forecastStartTime: "bad" },
      { temperatureMax: { value: 10 } },
      qweatherDay("2026-12-11"),
    ]);

    assert.equal(days.length, 1);
    assert.equal(days[0].date, "2026-12-11");
  });

  it("缺失的条件字段留空而不抛错", () => {
    const days = mapQWeatherDays([{ forecastStartTime: "2026-12-12T00:00Z" }]);

    assert.equal(days.length, 1);
    assert.equal(days[0].dayWeather, "");
    assert.equal(days[0].dayTemp, "");
    assert.equal(days[0].windDirection, "");
  });
});

describe("travel/weather 降级顺序", () => {
  before(() => {
    requests = [];
  });

  afterEach(() => {
    restoreEnv();
    globalThis.fetch = originalFetch;
  });

  after(() => {
    restoreEnv();
    globalThis.fetch = originalFetch;
  });

  it("未配置任何天气来源时返回空且不报错", async () => {
    delete process.env.QWEATHER_KEY;
    delete process.env.QWEATHER_HOST;
    delete process.env.AMAP_WEB_KEY;

    const result = await fetchTravelWeather("109.5,18.2");

    assert.equal(result.days.length, 0);
    assert.equal(result.warning, null);
  });

  it("配置了 Key 但缺 Host 时给出可执行的提示", async () => {
    process.env.QWEATHER_KEY = "test-key";
    delete process.env.QWEATHER_HOST;

    const result = await fetchTravelWeather("109.5,18.2");

    assert.equal(result.days.length, 0);
    assert.ok(result.warning?.includes("QWEATHER_HOST"), `实际告警：${result.warning}`);
  });

  it("和风可用时优先使用和风", async () => {
    process.env.QWEATHER_KEY = "test-key";
    process.env.QWEATHER_HOST = "https://example.qweatherapi.com";

    requests = [];

    installFakeFetch((url) =>
      url.includes("qweatherapi.com")
        ? { body: { days: [qweatherDay("2026-12-10")] } }
        : { body: { status: "0", info: "SHOULD NOT BE CALLED" } },
    );

    const result = await fetchTravelWeather("109.5,18.2", "460200");

    assert.equal(result.source, "和风天气");
    assert.equal(result.days.length, 1);
    assert.ok(result.days[0].dayWeather.length > 0);
    assert.equal(
      requests.some((u) => u.includes("restapi.amap.com")),
      false,
      "和风可用时不应再请求高德",
    );
  });

  it("请求和风时必须带 lang=zh，否则会返回当地语言", async () => {
    process.env.QWEATHER_KEY = "test-key";
    process.env.QWEATHER_HOST = "https://example.qweatherapi.com";

    requests = [];

    installFakeFetch(() => ({ body: { days: [qweatherDay("2026-12-10")] } }));

    await fetchTravelWeather("139.80,35.68");

    const url = requests.find((item) => item.includes("qweatherapi.com")) ?? "";

    // 实测不加 lang 时，东京返回「晴れ」、巴黎返回「Ensoleillé」
    assert.ok(url.includes("lang=zh"), `请求应带 lang=zh，实际：${url}`);
    assert.ok(url.includes("localTime=true"), `请求应带 localTime=true，实际：${url}`);
    assert.ok(url.includes("/weather/v1/daily/"), `应使用新版 v1 接口，实际：${url}`);
  });

  it("localTime=true 时按当地日期取日，不因时区错位", () => {
    // 和风在 localTime=true 下返回的 forecastStartTime 已是当地日期
    const days = mapQWeatherDays([
      { forecastStartTime: "2026-12-10T00:00+09:00", daytime: { condition: { text: "晴" } } },
    ]);

    assert.equal(days.length, 1);
    assert.equal(days[0].date, "2026-12-10");
  });

  it("和风报错时退回高德", async () => {
    process.env.QWEATHER_KEY = "test-key";
    process.env.QWEATHER_HOST = "https://example.qweatherapi.com";
    process.env.AMAP_WEB_KEY = "amap-key";

    requests = [];

    installFakeFetch((url) => {
      if (url.includes("qweatherapi.com")) {
        return { status: 403, body: { error: { title: "Invalid Host" } } };
      }

      return {
        body: {
          status: "1",
          forecasts: [{ casts: [{ date: "2026-12-10", dayweather: "晴", daytemp: "28", nighttemp: "20" }] }],
        },
      };
    });

    const result = await fetchTravelWeather("109.5,18.2", "460200");

    assert.equal(result.source, "高德");
    assert.equal(result.days.length, 1);
    assert.equal(result.days[0].dayWeather, "晴");
  });
});
