import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildPlanDocument, documentFileName, resolveExportOptions } from "./export";
import { fetchDayMapImages } from "./exportImages";
import type { TravelPlan } from "./types";

/**
 * 导出模式与图片嵌入的测试。
 *
 * 覆盖三种模式（完整 / 精简 / 单日）的区块取舍，
 * 以及「Key 不进文档」这条安全约束。
 */

const ORIGINAL_KEY = process.env.AMAP_WEB_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.AMAP_WEB_KEY;
  else process.env.AMAP_WEB_KEY = ORIGINAL_KEY;
});

/** 一份 3 天的方案 */
function makePlan(): TravelPlan {
  const day = (n: number) => ({
    day: n,
    date: `2026-11-0${n}`,
    theme: `第 ${n} 天主题`,
    activities: [
      {
        startTime: "09:00",
        endTime: "11:00",
        title: `第${n}天景点`,
        kind: "sight" as const,
        description: `第${n}天的详细说明文字，长度足够体现精简版的差异`,
        estimatedCost: 50,
        costSource: "estimate" as const,
        coordinates: `120.1${n},30.2${n}`,
      },
      // 每天至少两个有坐标的活动 —— 静态图需要两点才能表达「路线」，
      // 只有一个点时 buildDayMapUrlSafe 会返回 null（这是设计如此）
      {
        startTime: "14:00",
        endTime: "16:00",
        title: `第${n}天第二个地点`,
        kind: "sight" as const,
        description: "下午的安排",
        estimatedCost: 30,
        costSource: "estimate" as const,
        coordinates: `120.2${n},30.3${n}`,
      },
    ],
    estimatedCost: 300,
    accommodation: "测试酒店",
  });

  return {
    query: {
      origin: "上海",
      destination: "杭州",
      departDate: "2026-11-01",
      returnDate: "2026-11-03",
      party: { adults: 2, children: 0 },
      budget: 6000,
      style: "comfort",
      interests: [],
    },
    duration: { nights: 2, days: 3 },
    quotes: {
      flight: null,
      hotel: {
        confidence: "live",
        provider: "rollinggo",
        note: "报价说明",
        fetchedAt: "2026-10-15T00:00:00.000Z",
        name: "测试酒店",
        rating: 4,
        pricePerNight: 400,
        totalPrice: 800,
        currency: "CNY",
        rooms: 1,
      },
      warnings: [],
    },
    budget: {
      total: 6000,
      currency: "CNY",
      categories: [
        {
          key: "transport",
          label: "交通",
          amount: 1000,
          ratio: 0.1667,
          perPerson: 500,
          lockedByQuote: false,
          detail: "估算",
        },
      ],
      allocated: 6000,
      perPerson: 3000,
      perPersonPerDay: 1000,
      minimumViable: 4000,
      feasible: true,
      diagnosis: [],
    },
    overview: "本次杭州行程概览。",
    itinerary: [day(1), day(2), day(3)],
    checklist: ["身份证"],
    tips: ["提示一"],
    generatedByAI: true,
    model: "deepseek-chat",
    generatedAt: "2026-10-15T02:00:00.000Z",
    warnings: ["告警一"],
    hotelRooms: [
      {
        roomName: "标准房",
        averagePrice: 400,
        bedType: "1 大床",
        meal: "含早餐",
        cancelPolicy: "免费取消",
        cancelable: true,
        size: "25",
        maxOccupancy: 2,
      },
    ],
    dayRoutePolylines: { 1: "120.10,30.20;120.11,30.21", 2: "120.12,30.22;120.13,30.23" },
  };
}

describe("travel/export 选项归一化", () => {
  it("默认完整模式", () => {
    const opts = resolveExportOptions();

    assert.equal(opts.mode, "full");
    assert.equal(opts.day, null);
    assert.equal(opts.includeMaps, true);
  });

  it("★ 只给 day 不给 mode 时按单日处理", () => {
    const opts = resolveExportOptions({ day: 2 });

    assert.equal(opts.mode, "day");
    assert.equal(opts.day, 2);
  });

  it("非法 day 退回完整模式", () => {
    assert.equal(resolveExportOptions({ mode: "day", day: 0 }).day, null);
    assert.equal(resolveExportOptions({ mode: "day", day: -1 }).day, null);
    assert.equal(resolveExportOptions({ mode: "day" }).day, null);
  });

  it("maps: false 关闭图片", () => {
    assert.equal(resolveExportOptions({ includeMaps: false }).includeMaps, false);
  });

  it("未知 mode 退回完整", () => {
    assert.equal(resolveExportOptions({ mode: "weird" as never }).mode, "full");
  });
});

describe("travel/export 完整模式", () => {
  it("包含全部区块", () => {
    const doc = buildPlanDocument(makePlan());
    const titles = doc.sections.map((s) => s.title);

    assert.ok(titles.includes("行程概览"));
    assert.ok(titles.includes("交通与住宿"));
    assert.ok(titles.includes("可选房型"));
    assert.ok(titles.includes("预算分配"));
    assert.ok(titles.includes("行前准备"));
    assert.ok(titles.includes("出行提示"));
    assert.ok(titles.includes("数据来源与提示"));
  });

  it("逐日区块带 day 字段（供渲染层插图）", () => {
    const doc = buildPlanDocument(makePlan());
    const days = doc.sections.filter((s) => s.day !== undefined);

    assert.equal(days.length, 3);
    assert.deepEqual(days.map((d) => d.day), [1, 2, 3]);
  });
});

describe("travel/export 精简模式", () => {
  it("★ 保留概览、报价、房型与逐日，去掉行前准备与告警", () => {
    const doc = buildPlanDocument(makePlan(), { mode: "compact" });
    const titles = doc.sections.map((s) => s.title);

    assert.ok(titles.includes("行程概览"), "应保留概览");
    assert.ok(titles.includes("交通与住宿"), "应保留报价");
    assert.ok(titles.some((t) => t.includes("第 1 天")), "应保留逐日");
    assert.ok(titles.includes("预算分配"), "应保留预算");
    // 房型对预订有实际用处，因此精简版保留
    assert.ok(titles.includes("可选房型"), "精简版保留房型明细");

    assert.ok(!titles.includes("行前准备"), "精简版应去掉行前准备");
    assert.ok(!titles.includes("数据来源与提示"), "精简版应去掉告警");
  });

  it("★ 活动只列时间与标题，不带说明文字", () => {
    const doc = buildPlanDocument(makePlan(), { mode: "compact" });
    const day1 = doc.sections.find((s) => s.title.includes("第 1 天"));
    const bullet = day1?.bullets?.[0] ?? "";

    assert.ok(bullet.includes("第1天景点"));
    assert.ok(!bullet.includes("详细说明文字"), `精简版不应含描述：${bullet}`);
  });

  it("完整模式仍带说明文字", () => {
    const doc = buildPlanDocument(makePlan());
    const day1 = doc.sections.find((s) => s.title.includes("第 1 天"));

    assert.ok(day1?.bullets?.[0].includes("详细说明文字"));
  });

  it("页脚标注精简版", () => {
    assert.ok(buildPlanDocument(makePlan(), { mode: "compact" }).footer.includes("精简版"));
  });
});

describe("travel/export 单日模式", () => {
  it("★ 只含指定那一天", () => {
    const doc = buildPlanDocument(makePlan(), { mode: "day", day: 2 });
    const days = doc.sections.filter((s) => s.day !== undefined);

    assert.equal(days.length, 1);
    assert.equal(days[0].day, 2);
  });

  it("标题与副标题标明是第几天", () => {
    const doc = buildPlanDocument(makePlan(), { mode: "day", day: 2 });

    assert.ok(doc.header.title.includes("第 2 天"));
    assert.ok(doc.header.subtitle.includes("第 2 天 / 共 3 天"));
  });

  it("★ 跳过房型、跨城方式与行前准备", () => {
    const doc = buildPlanDocument(makePlan(), { mode: "day", day: 1 });
    const titles = doc.sections.map((s) => s.title);

    assert.ok(!titles.includes("可选房型"));
    assert.ok(!titles.includes("行前准备"));
    assert.ok(!titles.some((t) => t.includes("跨城方式")));
  });

  it("★ 预算改为「当日预算」而非整趟分配表", () => {
    const doc = buildPlanDocument(makePlan(), { mode: "day", day: 1 });
    const titles = doc.sections.map((s) => s.title);

    assert.ok(titles.includes("当日预算"));
    assert.ok(!titles.includes("预算分配"), "单日版不应给整趟分配表");
  });

  it("指定不存在的天数时不崩溃，退化为无逐日区块", () => {
    const doc = buildPlanDocument(makePlan(), { mode: "day", day: 99 });
    const days = doc.sections.filter((s) => s.day !== undefined);

    assert.equal(days.length, 0);
    // 但仍应有概览等基础区块
    assert.ok(doc.sections.length > 0);
  });

  it("页脚标注单日版", () => {
    const doc = buildPlanDocument(makePlan(), { mode: "day", day: 3 });

    assert.ok(doc.footer.includes("单日版（第 3 天）"));
  });
});

describe("travel/export 文件名带模式后缀", () => {
  it("完整模式无后缀", () => {
    const name = documentFileName(makePlan());

    assert.ok(!name.includes("精简"));
    assert.ok(!name.includes("第1天"));
  });

  it("精简版加后缀", () => {
    assert.ok(documentFileName(makePlan(), { mode: "compact" }).includes("精简版"));
  });

  it("单日版带天数", () => {
    assert.ok(documentFileName(makePlan(), { mode: "day", day: 2 }).includes("第2天"));
  });
});

describe("travel/exportImages 逐日路线图", () => {
  it("未配置高德 Key 时不发请求", async () => {
    delete process.env.AMAP_WEB_KEY;

    const originalFetch = globalThis.fetch;
    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      throw new Error("不应发起请求");
    }) as typeof fetch;

    try {
      const result = await fetchDayMapImages(makePlan());

      assert.equal(called, 0, "未配置 Key 时不应请求");
      assert.equal(result.images.length, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("★ 取回图片二进制", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const originalFetch = globalThis.fetch;

    // 造一张超过 1KB 的假 PNG
    const fakePng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.alloc(2000, 1),
    ]);

    globalThis.fetch = (async () =>
      new Response(new Uint8Array(fakePng), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })) as typeof fetch;

    try {
      const result = await fetchDayMapImages(makePlan());

      assert.equal(result.images.length, 3, "三天都应有图");
      assert.equal(result.failed.length, 0);
      assert.ok(result.images[0].data.length > 1000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("只取指定天数", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const originalFetch = globalThis.fetch;
    const fakePng = Buffer.concat([Buffer.from([0x89]), Buffer.alloc(2000, 1)]);

    globalThis.fetch = (async () =>
      new Response(new Uint8Array(fakePng), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })) as typeof fetch;

    try {
      const result = await fetchDayMapImages(makePlan(), [2]);

      assert.equal(result.images.length, 1);
      assert.equal(result.images[0].day, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("★ 接口返回 JSON 而非图片时按失败处理（并重试）", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const originalFetch = globalThis.fetch;
    let called = 0;

    globalThis.fetch = (async () => {
      called++;
      return new Response(JSON.stringify({ status: "0", info: "CUQPS_HAS_EXCEEDED_THE_LIMIT" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const result = await fetchDayMapImages(makePlan(), [1]);

      assert.equal(result.images.length, 0);
      assert.equal(result.failed.length, 1, "该天应记为失败");
      // 失败会重试：首次 + 2 次重试 = 3 次
      assert.ok(called >= 3, `应重试，实际调用 ${called} 次`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("★ 首次失败后重试成功（应对限流）", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const originalFetch = globalThis.fetch;
    let n = 0;

    globalThis.fetch = (async () => {
      n++;

      // 第一次返回限流错误，之后成功
      if (n === 1) {
        return new Response(JSON.stringify({ status: "0", info: "CUQPS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const png = Buffer.concat([Buffer.from([0x89]), Buffer.alloc(2000, 1)]);

      return new Response(new Uint8Array(png), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }) as typeof fetch;

    try {
      const result = await fetchDayMapImages(makePlan(), [1]);

      assert.equal(result.images.length, 1, "重试后应成功");
      assert.equal(result.failed.length, 0);
      assert.equal(n, 2, "应为 2 次调用");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("HTTP 错误时记为失败且不影响其它天", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const originalFetch = globalThis.fetch;

    /**
     * 按 URL 判断是哪一天，而不是按调用序号 ——
     * 失败会重试，序号会漂移，用序号判断会做出不稳定的测试。
     * 第 2 天的坐标以 120.12/30.22 开头（见 makePlan 的模板）。
     */
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("120.12")) return new Response("err", { status: 500 });

      const png = Buffer.concat([Buffer.from([0x89]), Buffer.alloc(2000, 1)]);

      return new Response(new Uint8Array(png), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }) as typeof fetch;

    try {
      const result = await fetchDayMapImages(makePlan(), [1, 2, 3]);

      assert.deepEqual(
        result.failed,
        [2],
        `第 2 天应失败，实际失败 ${JSON.stringify(result.failed)}`,
      );
      assert.deepEqual(
        result.images.map((i) => i.day),
        [1, 3],
        "其余天应成功",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("limit 限制取图数量", async () => {
    process.env.AMAP_WEB_KEY = "test_key";

    const originalFetch = globalThis.fetch;
    const png = Buffer.concat([Buffer.from([0x89]), Buffer.alloc(2000, 1)]);

    globalThis.fetch = (async () =>
      new Response(new Uint8Array(png), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })) as typeof fetch;

    try {
      const result = await fetchDayMapImages(makePlan(), undefined, 2);

      assert.equal(result.images.length, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("★ 图片 URL 未写入文档（Key 不泄露）", async () => {
    process.env.AMAP_WEB_KEY = "secret_key_should_not_leak";

    const doc = buildPlanDocument(makePlan());
    const serialized = JSON.stringify(doc);

    assert.ok(!serialized.includes("secret_key_should_not_leak"), "文档结构不应含 Key");
    assert.ok(!serialized.includes("restapi.amap.com"), "文档结构不应含地图 URL");
  });
});
