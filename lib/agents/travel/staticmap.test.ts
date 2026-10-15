import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  buildDayMapUrl,
  centerOf,
  isStaticMapConfigured,
  isValidLocation,
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
