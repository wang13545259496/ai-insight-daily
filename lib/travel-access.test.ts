import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  COOKIE_MAX_AGE,
  TRAVEL_COOKIE,
  hasValidAccess,
  isTravelProtected,
  safeEqual,
  travelPassword,
  travelToken,
  verifyPassword,
} from "./travel-access";

/**
 * 旅行模块访问口令测试。
 *
 * 这段逻辑决定「谁能看到旅行模块」，是安全相关的，因此覆盖：
 *   · 未配置口令时必须放行（否则会把自己锁在门外）
 *   · Cookie 里存的是派生令牌，不是口令本身
 *   · 比较使用恒定时间实现
 */

const ORIGINAL = process.env.TRAVEL_PASSWORD;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TRAVEL_PASSWORD;
  else process.env.TRAVEL_PASSWORD = ORIGINAL;
});

describe("travel-access 配置读取", () => {
  it("未配置时视为未启用保护", () => {
    delete process.env.TRAVEL_PASSWORD;

    assert.equal(travelPassword(), null);
    assert.equal(isTravelProtected(), false);
  });

  it("空白值视为未配置", () => {
    process.env.TRAVEL_PASSWORD = "   ";

    assert.equal(travelPassword(), null);
    assert.equal(isTravelProtected(), false);
  });

  it("配置后启用保护并去除首尾空白", () => {
    process.env.TRAVEL_PASSWORD = "  secret123  ";

    assert.equal(travelPassword(), "secret123");
    assert.equal(isTravelProtected(), true);
  });
});

describe("travel-access 令牌派生", () => {
  it("★ 同一口令派生出稳定令牌（重启后仍有效）", async () => {
    process.env.TRAVEL_PASSWORD = "secret123";

    const a = await travelToken();
    const b = await travelToken();

    assert.ok(a);
    assert.equal(a, b, "派生结果应稳定");
  });

  it("★ 不同口令派生不同令牌", async () => {
    process.env.TRAVEL_PASSWORD = "secret123";
    const a = await travelToken();

    process.env.TRAVEL_PASSWORD = "secret456";
    const b = await travelToken();

    assert.ok(a && b);
    assert.notEqual(a, b);
  });

  it("★ 令牌里不含口令原文（Cookie 泄露也无法反推）", async () => {
    process.env.TRAVEL_PASSWORD = "my-plain-password";

    const token = await travelToken();

    assert.ok(token);
    assert.ok(!token.includes("my-plain-password"));
    // SHA-256 的十六进制表示固定 64 字符
    assert.equal(token.length, 64);
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  it("未配置口令时无法派生令牌", async () => {
    delete process.env.TRAVEL_PASSWORD;

    assert.equal(await travelToken(), null);
  });
});

describe("travel-access 口令校验", () => {
  it("正确口令通过", async () => {
    process.env.TRAVEL_PASSWORD = "correct";

    assert.equal(await verifyPassword("correct"), true);
  });

  it("错误口令拒绝", async () => {
    process.env.TRAVEL_PASSWORD = "correct";

    assert.equal(await verifyPassword("wrong"), false);
    assert.equal(await verifyPassword(""), false);
    assert.equal(await verifyPassword("Correct"), false);
  });

  it("未配置口令时一律通过（保持公开）", async () => {
    delete process.env.TRAVEL_PASSWORD;

    assert.equal(await verifyPassword("anything"), true);
  });
});

describe("travel-access 恒定时间比较", () => {
  it("相同字符串返回 true", () => {
    assert.equal(safeEqual("abc123", "abc123"), true);
    assert.equal(safeEqual("", ""), true);
  });

  it("不同字符串返回 false", () => {
    assert.equal(safeEqual("abc123", "abc124"), false);
    assert.equal(safeEqual("abc", "abcd"), false, "长度不同也应 false");
    assert.equal(safeEqual("", "a"), false);
  });

  it("★ 前缀相同的字符串同样返回 false（不因提前返回而漏判）", () => {
    assert.equal(safeEqual("abcdefgh", "abcdefgX"), false);
  });
});

describe("travel-access 访问判定", () => {
  it("★ 未启用保护时无论有无 Cookie 都放行", async () => {
    delete process.env.TRAVEL_PASSWORD;

    assert.equal(await hasValidAccess(undefined), true);
    assert.equal(await hasValidAccess("whatever"), true);
  });

  it("启用保护且令牌匹配时放行", async () => {
    process.env.TRAVEL_PASSWORD = "secret123";

    const token = await travelToken();

    assert.equal(await hasValidAccess(token ?? undefined), true);
  });

  it("★ 启用保护但无 Cookie 时拒绝", async () => {
    process.env.TRAVEL_PASSWORD = "secret123";

    assert.equal(await hasValidAccess(undefined), false);
    assert.equal(await hasValidAccess(""), false);
  });

  it("★ 令牌不匹配时拒绝", async () => {
    process.env.TRAVEL_PASSWORD = "secret123";

    assert.equal(await hasValidAccess("deadbeef"), false);
    assert.equal(await hasValidAccess("a".repeat(64)), false);
  });
});

describe("travel-access 常量", () => {
  it("Cookie 名与有效期符合预期", () => {
    assert.equal(TRAVEL_COOKIE, "travel_access");
    assert.equal(COOKIE_MAX_AGE, 60 * 60 * 24 * 30, "应为 30 天");
  });
});
