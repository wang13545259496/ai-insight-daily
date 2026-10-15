import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  buildDayMapUrl,
  buildDayMapUrlSafe,
  buildDayRoutePolyline,
  centerOf,
  isStaticMapConfigured,
  isValidLocation,
  thinPolyline,
} from "./staticmap";
import type { MapPoint } from "./staticmap";

/**
 * 逐日路线静态图测试。
 *
 * 两处参数格式是实测踩坑得出的，测试里固定住，避免以后改坏：
 *   · markers 用管道符 `|` 分隔；用分号会返回 UNKNOWN_ERROR（20003）
 *   · paths 用分号 `;` 分隔
 */

const ORIGINAL_KEY = process.env.AMAP_WEB_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.AMAP_WEB_KEY;
  else process.env.AMAP_WEB_KEY = ORIGINAL_KEY;
});

/** 西湖片区的真实坐标 */
const HANGZHOU: MapPoint[] = [
  { location: "120.140000,30.250000", index: 1 },
  { location: "120.144000,30.246000", index: 2 },
  { location: "120.150000,30.240000", index: 3 },
];

describe("travel/staticmap 坐标校验", () => {
  it("合法坐标通过", () => {
    assert.equal(isValidLocation("120.14,30.25"), true);
    assert.equal(isValidLocation("0,0"), true);
    assert.equal(isValidLocation("-74.01,40.71"), true);
  });

  it("格式错误被拒", () => {
    assert.equal(isValidLocation(""), false);
    assert.equal(isValidLocation("120.14"), false);
    assert.equal(isValidLocation("120.14,30.25,1"), false);
    assert.equal(isValidLocation("abc,def"), false);
  });

  it("越界坐标被拒", () => {
    assert.equal(isValidLocation("200,30"), false);
    assert.equal(isValidLocation("120,100"), false);
  });
});

describe("travel/staticmap URL 生成", () => {
  it("未配置 Key 时返回 null", () => {
    delete process.env.AMAP_WEB_KEY;

    assert.equal(buildDayMapUrl(HANGZHOU), null);
    assert.equal(isStaticMapConfigured(), false);
  });

  it("★ markers 用管道符分隔（回归：用分号会返回 UNKNOWN_ERROR）", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const url = buildDayMapUrl(HANGZHOU);

    assert.ok(url, "应生成 URL");
    assert.ok(url.includes("|"), "markers 应用管道符分隔");
    assert.ok(!url.includes(";large"), "markers 不应使用分号分隔");
  });

  it("paths 用分号分隔", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const url = buildDayMapUrl(HANGZHOU);

    assert.ok(url?.includes("paths="), "应含 paths 参数");
    assert.ok(url?.includes(";120.150000"), "paths 应用分号分隔各点");
  });

  it("★ 少于两个坐标时返回 null（一个点无法表达路线）", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    assert.equal(buildDayMapUrl([HANGZHOU[0]]), null);
    assert.equal(buildDayMapUrl([]), null);
  });

  it("无效坐标被过滤掉", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const mixed: MapPoint[] = [
      HANGZHOU[0],
      { location: "bad", index: 2 },
      HANGZHOU[1],
    ];

    const url = buildDayMapUrl(mixed);

    assert.ok(url, "过滤后仍有两点，应生成 URL");
    assert.ok(!url.includes("bad"));
  });

  it("全部坐标无效时返回 null", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const bad: MapPoint[] = [
      { location: "bad", index: 1 },
      { location: "worse", index: 2 },
    ];

    assert.equal(buildDayMapUrl(bad), null);
  });

  it("点数超过上限时截断（避免 URL 过长）", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const many: MapPoint[] = Array.from({ length: 15 }, (_, i) => ({
      location: `120.${140 + i},30.${250 - i}`,
      index: i + 1,
    }));

    const url = buildDayMapUrl(many);

    assert.ok(url);
    // 最多 8 个标记
    const markerCount = (url.match(/large,/g) || []).length;

    assert.ok(markerCount <= 8, `标记数 ${markerCount} 应不超过 8`);
  });

  it("URL 含尺寸与 Key", () => {
    process.env.AMAP_WEB_KEY = "my_key";

    const url = buildDayMapUrl(HANGZHOU);

    assert.ok(url?.includes(`size=${MAP_WIDTH}*${MAP_HEIGHT}`));
    assert.ok(url?.includes("key=my_key"));
    assert.ok(url?.startsWith("https://restapi.amap.com/v3/staticmap?"));
  });

  it("编号按传入的 index 保留（用于对应活动顺序）", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const url = buildDayMapUrl([
      { location: "120.14,30.25", index: 1 },
      { location: "120.15,30.24", index: 5 },
    ]);

    assert.ok(url?.includes(",1:120.14,30.25"), "应保留编号 1");
    assert.ok(url?.includes(",5:120.15,30.24"), "应保留编号 5");
  });
});

describe("travel/staticmap 中心点", () => {
  it("计算坐标平均值", () => {
    const center = centerOf(HANGZHOU);

    assert.ok(center);
    const [lng, lat] = center.split(",").map(Number);

    assert.ok(Math.abs(lng - 120.1447) < 0.001, `经度 ${lng}`);
    assert.ok(Math.abs(lat - 30.2453) < 0.001, `纬度 ${lat}`);
  });

  it("空数组返回 null", () => {
    assert.equal(centerOf([]), null);
  });

  it("全部无效坐标返回 null", () => {
    assert.equal(centerOf([{ location: "bad", index: 1 }]), null);
  });

  it("单点返回该点本身", () => {
    const center = centerOf([{ location: "120.14,30.25", index: 1 }]);

    assert.equal(center, "120.140000,30.250000");
  });
});

describe("travel/staticmap 折线抽稀", () => {
  /** 造一条指定点数的折线 */
  const makePolyline = (n: number) =>
    Array.from({ length: n }, (_, i) => `116.${397000 + i},39.${916000 + i}`).join(";");

  it("不超长时原样返回", () => {
    const short = makePolyline(5);

    assert.equal(thinPolyline(short, 1000), short);
  });

  it("★ 超长时抽稀，且保留首尾点", () => {
    const long = makePolyline(116);
    const thinned = thinPolyline(long, 500);

    assert.ok(thinned.length <= long.length, "抽稀后应更短");

    const first = long.split(";")[0];
    const last = long.split(";")[long.split(";").length - 1];
    const thinnedPoints = thinned.split(";");

    assert.equal(thinnedPoints[0], first, "首点应保留");
    assert.equal(thinnedPoints[thinnedPoints.length - 1], last, "末点应保留（避免路线终点缺失）");
  });

  it("抽稀后点数减少但仍大于 2", () => {
    const long = makePolyline(116);
    const thinned = thinPolyline(long, 500);
    const count = thinned.split(";").length;

    assert.ok(count >= 2, `点数 ${count} 应至少 2`);
    assert.ok(count < 116, `点数 ${count} 应少于原值`);
  });

  it("点数过少时不抽稀（避免退化成一条直线）", () => {
    const two = makePolyline(2);

    assert.equal(thinPolyline(two, 1), two);
  });

  it("空串原样返回", () => {
    assert.equal(thinPolyline("", 100), "");
  });
});

describe("travel/staticmap 真实路线 URL", () => {
  it("有折线时 paths 用折线而非直连", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const polyline = "116.397,39.916;116.400,39.920;116.405,39.925";
    const url = buildDayMapUrl(HANGZHOU, polyline);

    assert.ok(url?.includes("116.400,39.920"), "应含折线中间点");
    assert.ok(!url?.includes("120.144000,30.246000;120.150000"), "不应是直连");
  });

  it("无折线时回退直连", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const url = buildDayMapUrl(HANGZHOU, null);

    assert.ok(url?.includes("120.140000,30.250000;120.144000,30.246000"), "应为直连");
  });

  it("buildDayMapUrlSafe 在折线过长时退回直连", () => {
    process.env.AMAP_WEB_KEY = "test_key";

    // 造一条极长的折线，抽稀后仍超限
    const huge = Array.from({ length: 5000 }, (_, i) => `116.${397000 + i},39.${916000 + i}`).join(";");

    const url = buildDayMapUrlSafe(HANGZHOU, huge);

    assert.ok(url, "应仍返回可用 URL");
    assert.ok(url.length <= 3500, `URL 长度 ${url.length} 应受控`);
  });
});

describe("travel/staticmap 逐日路线拼接", () => {
  const fetchOk = async (from: string, to: string) => `${from};${to}`;

  it("★ 拼接相邻段的折线，并去掉共享端点的重复", async () => {
    // 两段：[A;B] 与 [B;C]，拼接后应为 A;B;C（B 只出现一次）
    const result = await buildDayRoutePolyline(
      ["120.140,30.250", "120.144,30.246", "120.150,30.240"],
      async (from, to) => `${from};${to}`,
    );

    assert.ok(result);
    assert.equal(result, "120.140,30.250;120.144,30.246;120.150,30.240");
    assert.equal(result.split(";").length, 3, "共享端点不应重复");
  });

  it("少于两个点时返回 null", async () => {
    assert.equal(await buildDayRoutePolyline(["120.140,30.250"], fetchOk), null);
    assert.equal(await buildDayRoutePolyline([], fetchOk), null);
  });

  it("无效坐标被过滤", async () => {
    const result = await buildDayRoutePolyline(
      ["120.140,30.250", "bad", "120.150,30.240"],
      fetchOk,
    );

    assert.ok(result);
    assert.ok(!result.includes("bad"));
  });

  it("★ 部分段失败时仍返回已取到的部分（不因单点失败整天无图）", async () => {
    let call = 0;

    const flaky = async (from: string, to: string) => {
      call++;
      // 第二段失败
      return call === 2 ? null : `${from};${to}`;
    };

    const result = await buildDayRoutePolyline(
      ["120.140,30.250", "120.144,30.246", "120.150,30.240"],
      flaky,
    );

    assert.ok(result, "应有部分结果");
  });

  it("全部段失败时返回 null", async () => {
    const allFail = async () => null;

    assert.equal(
      await buildDayRoutePolyline(
        ["120.140,30.250", "120.144,30.246"],
        allFail,
      ),
      null,
    );
  });

  it("抛异常的取线函数不会导致整体失败", async () => {
    const thrower = async () => {
      throw new Error("网络错误");
    };

    assert.equal(
      await buildDayRoutePolyline(["120.140,30.250", "120.144,30.246"], thrower),
      null,
    );
  });

  it("点数过多时截断到 6 个（控制请求数）", async () => {
    const calls: string[] = [];

    const counter = async (from: string, to: string) => {
      calls.push(`${from}->${to}`);
      return `${from};${to}`;
    };

    const many = Array.from({ length: 12 }, (_, i) => `120.${140 + i},30.${250 - i}`);

    await buildDayRoutePolyline(many, counter);

    // 6 个点 → 5 段
    assert.equal(calls.length, 5, `实际发起 ${calls.length} 次请求`);
  });
});
