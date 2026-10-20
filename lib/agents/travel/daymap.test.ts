import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { renderDayMapPng } from "./daymap";
import type { DayMapStop } from "./daymap-core";

/**
 * 逐日地图**渲染层**测试（服务端）。
 *
 * 这里验证的是「真的能出一张图」：未配置 Key、取底图失败、合成成功
 * 三条路径各自的行为。编号与取景的规则在 daymap-core.test.ts 里测，
 * 那边不需要网络与 sharp。
 */

const ORIGINAL_KEY = process.env.AMAP_WEB_KEY;
const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.AMAP_WEB_KEY;
  else process.env.AMAP_WEB_KEY = ORIGINAL_KEY;

  globalThis.fetch = ORIGINAL_FETCH;
});

/** 两个真实点位（故宫 / 景山） */
function stops(offset = 0): DayMapStop[] {
  return [
    {
      number: 1,
      location: `116.${397029 + offset},39.917839`,
      title: "故宫",
      activityIndexes: [0],
    },
    {
      number: 2,
      location: `116.${396551 + offset},39.925875`,
      title: "景山",
      activityIndexes: [1],
    },
  ];
}

describe("travel/daymap 渲染", () => {
  it("未配置 Key 时返回 null，且不发起请求", async () => {
    delete process.env.AMAP_WEB_KEY;

    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      throw new Error("不应发起请求");
    }) as typeof fetch;

    const png = await renderDayMapPng({ stops: stops() });

    assert.equal(png, null);
    assert.equal(called, 0, "未配置 Key 时不应请求高德");
  });

  it("★ 取底图失败时返回 null，不抛异常", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      return new Response("boom", { status: 500 });
    }) as typeof fetch;

    const png = await renderDayMapPng({ stops: stops(1) });

    assert.equal(png, null);
    assert.ok(called >= 2, `应重试，实际请求 ${called} 次`);
  });

  it("高德返回 JSON（限流）时同样按失败处理", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "0", info: "CUQPS_HAS_EXCEEDED_THE_LIMIT" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.equal(await renderDayMapPng({ stops: stops(2) }), null);
  });

  it("★ 合成出 PNG，尺寸为画布的 2 倍（高分屏）", async (t) => {
    const sharpModule = await import("sharp").catch(() => null);

    if (!sharpModule) {
      t.skip("环境缺少 sharp（Next 的可选依赖），跳过合成测试");
      return;
    }

    process.env.AMAP_WEB_KEY = "test_key";

    // 造一张纯色底图当高德的返回，验证合成链路本身
    const base = await sharpModule
      .default({ create: { width: 1440, height: 810, channels: 3, background: "#f4f1e8" } })
      .png()
      .toBuffer();

    globalThis.fetch = (async () =>
      new Response(new Uint8Array(base), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })) as typeof fetch;

    const png = await renderDayMapPng({ stops: stops(3) });

    assert.ok(png, "应出图");
    assert.equal(png.subarray(0, 4).toString("hex"), "89504e47", "应为 PNG");

    const meta = await sharpModule.default(png).metadata();

    assert.equal(meta.width, 1440);
    assert.equal(meta.height, 810);
  });

  it("没有任何坐标时返回 null", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    assert.equal(await renderDayMapPng({ stops: [] }), null);
  });
});
