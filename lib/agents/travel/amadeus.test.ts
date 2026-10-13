import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createEstimateProvider } from "./providers";

/**
 * Amadeus 接入的配置判定与降级行为。
 *
 * 这里只验证「无凭据时不发网络请求」这条关键保证：
 * 报价接口是按次计费的商务资源，绝不能在未配置时仍然发请求。
 */
describe("travel/amadeus 配置缺失时的行为", () => {
  it("估算 Provider 在无凭据环境下被使用且不发网络请求", async () => {
    // 清空凭据，模拟未配置的默认状态
    const originalId = process.env.AMADEUS_CLIENT_ID;
    const originalSecret = process.env.AMADEUS_CLIENT_SECRET;

    delete process.env.AMADEUS_CLIENT_ID;
    delete process.env.AMADEUS_CLIENT_SECRET;

    try {
      // 动态导入，确保读到的是清空后的环境变量
      const amadeus = await import("./amadeus");

      assert.equal(amadeus.isAmadeusConfigured(), false);

      const provider = createEstimateProvider();
      const quotes = await provider.fetchQuotes({
        originCity: "北京",
        destinationCity: "东京",
        originCode: "BJS",
        destinationCode: "TYO",
        departDate: "2026-10-01",
        returnDate: "2026-10-05",
        nights: 4,
        party: { adults: 2, children: 0 },
        style: "comfort",
        rooms: 1,
        peakSeason: false,
      });

      assert.equal(quotes.flight?.provider, "heuristic");
      assert.equal(quotes.hotel?.provider, "heuristic");
    } finally {
      if (originalId !== undefined) {
        process.env.AMADEUS_CLIENT_ID = originalId;
      }

      if (originalSecret !== undefined) {
        process.env.AMADEUS_CLIENT_SECRET = originalSecret;
      }
    }
  });

  it("配置了凭据时判定为已配置", async () => {
    const originalId = process.env.AMADEUS_CLIENT_ID;
    const originalSecret = process.env.AMADEUS_CLIENT_SECRET;

    process.env.AMADEUS_CLIENT_ID = "test-id";
    process.env.AMADEUS_CLIENT_SECRET = "test-secret";

    try {
      const amadeus = await import("./amadeus");

      assert.equal(amadeus.isAmadeusConfigured(), true);
      assert.equal(amadeus.isAmadeusSandbox(), true, "默认应为测试环境");
    } finally {
      if (originalId === undefined) {
        delete process.env.AMADEUS_CLIENT_ID;
      } else {
        process.env.AMADEUS_CLIENT_ID = originalId;
      }

      if (originalSecret === undefined) {
        delete process.env.AMADEUS_CLIENT_SECRET;
      } else {
        process.env.AMADEUS_CLIENT_SECRET = originalSecret;
      }
    }
  });

  it("describeError 对超时给出可读说明", async () => {
    const { describeError } = await import("./amadeus");

    const abortError = new Error("aborted");
    abortError.name = "AbortError";

    assert.ok(describeError(abortError).includes("超时"));
    assert.equal(describeError(new Error("普通错误")), "普通错误");
    assert.equal(describeError("字符串错误"), "字符串错误");
  });
});
