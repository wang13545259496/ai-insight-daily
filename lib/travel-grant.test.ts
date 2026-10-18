import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  FRIEND_COOKIE_MAX_AGE,
  OWNER_GRANT,
  accessCookieOptions,
  canAccessPlan,
  cookieMaxAgeFor,
  grantToken,
  parseGrant,
  travelToken,
} from "./travel-access";
import {
  consumeRateLimit,
  formatRetryAfter,
  peekRateLimit,
  resetRateLimits,
} from "./travel-ratelimit";
import { hashCode, normalizeCode } from "./travel-invite";

/**
 * 好友身份、行程隔离、限流、邀请码归一化的测试。
 *
 * 这段决定「朋友能不能看到别人的行程」「能不能刷爆 AI 账单」，
 * 是安全与成本相关的，因此覆盖边界而不只是正常路径。
 */

const ORIGINAL = process.env.TRAVEL_PASSWORD;

beforeEach(() => {
  process.env.TRAVEL_PASSWORD = "test-password-123";
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.TRAVEL_PASSWORD;
  else process.env.TRAVEL_PASSWORD = ORIGINAL;

  resetRateLimits();
});

/* ============================================================
 * 身份令牌
 * ============================================================ */

describe("身份令牌：owner 保持旧格式", () => {
  it("grantToken(owner) 与 travelToken() 相同 —— 旧 Cookie 继续有效", async () => {
    const legacy = await travelToken();
    const owner = await grantToken(OWNER_GRANT);

    assert.ok(legacy);
    assert.equal(owner, legacy);
    assert.match(owner!, /^[0-9a-f]{64}$/);
  });

  it("旧格式 Cookie 解析为 owner", async () => {
    const legacy = await travelToken();

    assert.equal(await parseGrant(legacy!), OWNER_GRANT);
  });

  it("非法旧格式 Cookie 解析为 null", async () => {
    assert.equal(await parseGrant("a".repeat(64)), null);
    assert.equal(await parseGrant("deadbeef"), null);
    assert.equal(await parseGrant(undefined), null);
    assert.equal(await parseGrant(""), null);
  });
});

describe("身份令牌：好友格式", () => {
  it("好友令牌形如 <grantId>.<签名>", async () => {
    const token = await grantToken("gabc123");

    assert.ok(token);
    assert.match(token!, /^gabc123\.[0-9a-f]{64}$/);
  });

  it("能解析回原身份", async () => {
    const token = await grantToken("gabc123");

    assert.equal(await parseGrant(token!), "gabc123");
  });

  it("篡改 grantId 后签名失效", async () => {
    const token = await grantToken("gabc123");
    const forged = token!.replace("gabc123", "gxyz789");

    assert.equal(await parseGrant(forged), null);
  });

  it("篡改签名后失效", async () => {
    const token = await grantToken("gabc123");
    const forged = token!.slice(0, -1) + (token!.endsWith("0") ? "1" : "0");

    assert.equal(await parseGrant(forged), null);
  });

  it("空身份或空签名都拒绝", async () => {
    assert.equal(await parseGrant(".abc"), null);
    assert.equal(await parseGrant("gabc."), null);
  });

  it("未配置口令时派生为 null", async () => {
    delete process.env.TRAVEL_PASSWORD;

    assert.equal(await grantToken("gabc123"), null);
  });
});

/* ============================================================
 * Cookie 有效期
 * ============================================================ */

describe("Cookie 有效期按身份区分", () => {
  it("owner 30 天，好友 1 天", () => {
    assert.equal(cookieMaxAgeFor(OWNER_GRANT), 60 * 60 * 24 * 30);
    assert.equal(cookieMaxAgeFor("gabc123"), FRIEND_COOKIE_MAX_AGE);
    assert.equal(FRIEND_COOKIE_MAX_AGE, 60 * 60 * 24);
  });

  it("accessCookieOptions 默认按 owner 处理（保持旧调用方行为）", () => {
    assert.equal(accessCookieOptions().maxAge, 60 * 60 * 24 * 30);
  });

  it("accessCookieOptions(grantId) 跟随身份", () => {
    assert.equal(accessCookieOptions("gabc123").maxAge, FRIEND_COOKIE_MAX_AGE);
  });
});

/* ============================================================
 * 行程隔离
 * ============================================================ */

describe("行程归属判定", () => {
  it("维护者能看全部，包括历史数据（ownerGrant 为 null）", () => {
    assert.equal(canAccessPlan(OWNER_GRANT, "gabc123"), true);
    assert.equal(canAccessPlan(OWNER_GRANT, null), true);
    assert.equal(canAccessPlan(OWNER_GRANT, undefined), true);
  });

  it("好友只能看自己的", () => {
    assert.equal(canAccessPlan("gabc123", "gabc123"), true);
    assert.equal(canAccessPlan("gabc123", "gxyz789"), false);
  });

  it("好友看不到历史数据", () => {
    assert.equal(canAccessPlan("gabc123", null), false);
  });

  it("方案不存在时不可访问", () => {
    assert.equal(canAccessPlan("gabc123", undefined), false);
    assert.equal(canAccessPlan(OWNER_GRANT, undefined), true);
  });

  it("未登录一律不可访问", () => {
    assert.equal(canAccessPlan(null, "gabc123"), false);
    assert.equal(canAccessPlan(null, null), false);
  });
});

/* ============================================================
 * 限流
 * ============================================================ */

describe("生成频率限制", () => {
  it("默认每小时 5 次", () => {
    const peek = peekRateLimit("gabc123");

    assert.equal(peek.limit, 5);
    assert.equal(peek.used, 0);
    assert.equal(peek.allowed, true);
  });

  it("用满 5 次后拒绝第 6 次", () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(consumeRateLimit("gabc123").allowed, true);
    }

    const sixth = consumeRateLimit("gabc123");

    assert.equal(sixth.allowed, false);
    assert.equal(sixth.used, 5);
    assert.ok(sixth.retryAfterMs > 0);
  });

  it("被拒绝的请求不消耗配额", () => {
    for (let i = 0; i < 5; i++) consumeRateLimit("gabc123");

    consumeRateLimit("gabc123");
    consumeRateLimit("gabc123");

    assert.equal(peekRateLimit("gabc123").used, 5);
  });

  it("不同身份互不影响", () => {
    for (let i = 0; i < 5; i++) consumeRateLimit("gaaa");

    assert.equal(consumeRateLimit("gaaa").allowed, false);
    assert.equal(consumeRateLimit("gbbb").allowed, true);
  });

  it("reset 后恢复额度", () => {
    for (let i = 0; i < 5; i++) consumeRateLimit("gabc123");

    assert.equal(consumeRateLimit("gabc123").allowed, false);

    resetRateLimits();

    assert.equal(consumeRateLimit("gabc123").allowed, true);
  });

  it("等待时长文案可读", () => {
    assert.ok(formatRetryAfter(30_000).includes("1 分钟"));
    assert.ok(formatRetryAfter(10 * 60_000).includes("10 分钟"));
  });
});

/* ============================================================
 * 邀请码归一化
 * ============================================================ */

describe("邀请码归一化", () => {
  it("大小写、横线、空格都等价", () => {
    const a = normalizeCode("TRV-7K2M-9X4P");
    const b = normalizeCode("trv 7k2m 9x4p");
    const c = normalizeCode("Trv7K2m9X4p");

    assert.equal(a, "TRV7K2M9X4P");
    assert.equal(b, a);
    assert.equal(c, a);
  });

  it("哈希稳定且与输入形式无关", async () => {
    const h1 = await hashCode("TRV-7K2M-9X4P");
    const h2 = await hashCode("trv7k2m9x4p");

    assert.equal(h1, h2);
    assert.match(h1, /^[0-9a-f]{64}$/);
  });

  it("不同码的哈希不同", async () => {
    const h1 = await hashCode("TRV-7K2M-9X4P");
    const h2 = await hashCode("TRV-7K2M-9X4Q");

    assert.notEqual(h1, h2);
  });

  it("哈希不含明文", async () => {
    const h = await hashCode("TRV-7K2M-9X4P");

    assert.ok(!h.includes("7K2M"));
    assert.ok(!h.includes("TRV"));
  });

  it("空输入也能归一化（不抛错）", () => {
    assert.equal(normalizeCode(""), "");
    assert.equal(normalizeCode("---"), "");
  });
});
