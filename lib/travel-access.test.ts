import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  ACCESS_COOKIE_OPTIONS,
  COOKIE_MAX_AGE,
  TRAVEL_COOKIE,
  accessCookieOptions,
  clearCookieOptions,
  cookieSecure,
  hasValidAccess,
  isTravelAuthed,
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

describe("travel-access 登录态判定（isTravelAuthed）", () => {
  /**
   * 与 hasValidAccess 的关键区别：未启用保护时两者都为 true，
   * 但调用方有时需要区分「未启用保护」与「确实已登录」——
   * 例如同一页面上「表单对所有人公开」而「历史列表仅登录者可见」。
   */

  it("★ 未启用保护时视为已登录（不存在登录这回事）", async () => {
    delete process.env.TRAVEL_PASSWORD;

    assert.equal(await isTravelAuthed(undefined), true);
    assert.equal(await isTravelAuthed("任意值"), true);
  });

  it("启用保护且令牌匹配时为已登录", async () => {
    process.env.TRAVEL_PASSWORD = "secret123";

    const token = await travelToken();

    assert.equal(await isTravelAuthed(token ?? undefined), true);
  });

  it("★ 启用保护且无 Cookie 时为未登录", async () => {
    process.env.TRAVEL_PASSWORD = "secret123";

    assert.equal(await isTravelAuthed(undefined), false);
    assert.equal(await isTravelAuthed(""), false);
  });

  it("★ 令牌错误时视为未登录（而非抛错）", async () => {
    process.env.TRAVEL_PASSWORD = "secret123";

    assert.equal(await isTravelAuthed("wrong"), false);
  });

  it("未启用保护时两种判定结果一致", async () => {
    delete process.env.TRAVEL_PASSWORD;

    assert.equal(await hasValidAccess(undefined), await isTravelAuthed(undefined));
  });
});

describe("travel-access 常量", () => {
  it("Cookie 名与有效期符合预期", () => {
    assert.equal(TRAVEL_COOKIE, "travel_access");
    assert.equal(COOKIE_MAX_AGE, 60 * 60 * 24 * 30, "应为 30 天");
  });
});

describe("travel-access Cookie Secure 标志", () => {
  const ORIGINAL_SECURE = process.env.COOKIE_SECURE;

  afterEach(() => {
    if (ORIGINAL_SECURE === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = ORIGINAL_SECURE;
  });

  it("★ 只认 COOKIE_SECURE，不依赖 NODE_ENV", () => {
    /**
     * 线上经 pm2 启动时 NODE_ENV 未必被显式设置，因此判断不能依赖它。
     *
     * 这里不去改动 NODE_ENV（Next.js 把它声明为只读，且它恒有值），
     * 而是用等价且可验证的方式证明：
     *   · 未设 COOKIE_SECURE 时结果为 false（此时 NODE_ENV 通常已是 production，
     *     若实现依赖了它就会误判为 true）
     *   · 只有设了 COOKIE_SECURE 才为 true
     */
    delete process.env.COOKIE_SECURE;

    assert.equal(
      cookieSecure(),
      false,
      "未设 COOKIE_SECURE 时必须为 false —— 若实现读了 NODE_ENV，这里会失败",
    );

    process.env.COOKIE_SECURE = "1";

    assert.equal(cookieSecure(), true);
  });

  it("值为 1 时启用", () => {
    process.env.COOKIE_SECURE = "1";

    assert.equal(cookieSecure(), true);
  });

  it("未设置、空值或其它值时关闭", () => {
    delete process.env.COOKIE_SECURE;
    assert.equal(cookieSecure(), false);

    process.env.COOKIE_SECURE = "";
    assert.equal(cookieSecure(), false);

    process.env.COOKIE_SECURE = "true";
    assert.equal(cookieSecure(), false);

    process.env.COOKIE_SECURE = "0";
    assert.equal(cookieSecure(), false);
  });

  it("容忍首尾空白", () => {
    process.env.COOKIE_SECURE = " 1 ";

    assert.equal(cookieSecure(), true);
  });
});

describe("travel-access Cookie 属性", () => {
  const ORIGINAL_SECURE = process.env.COOKIE_SECURE;

  afterEach(() => {
    if (ORIGINAL_SECURE === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = ORIGINAL_SECURE;
  });

  it("★ 登录与续期用同一份属性（保证续期不会改掉原有行为）", () => {
    process.env.COOKIE_SECURE = "1";

    // 续期时用的就是 accessCookieOptions，与登录完全一致
    assert.deepEqual(accessCookieOptions(), {
      ...ACCESS_COOKIE_OPTIONS,
      secure: true,
      maxAge: COOKIE_MAX_AGE,
    });
  });

  it("★ 清除用的属性除 maxAge 外与写入一致", () => {
    process.env.COOKIE_SECURE = "1";

    const write = accessCookieOptions();
    const clear = clearCookieOptions();

    assert.equal(clear.maxAge, 0, "清除时 maxAge 应为 0");
    assert.equal(clear.path, write.path, "path 不一致会导致清不掉");
    assert.equal(clear.httpOnly, write.httpOnly);
    assert.equal(clear.sameSite, write.sameSite);
    assert.equal(clear.secure, write.secure);
  });

  it("HttpOnly 与 SameSite=lax 恒定", () => {
    assert.equal(ACCESS_COOKIE_OPTIONS.httpOnly, true, "HttpOnly 防 XSS 读取");
    assert.equal(ACCESS_COOKIE_OPTIONS.sameSite, "lax");
    assert.equal(ACCESS_COOKIE_OPTIONS.path, "/");
  });

  it("Secure 跟随 COOKIE_SECURE", () => {
    process.env.COOKIE_SECURE = "1";
    assert.equal(accessCookieOptions().secure, true);

    delete process.env.COOKIE_SECURE;
    assert.equal(accessCookieOptions().secure, false);
  });

  it("续期不会改变有效期长度（始终 30 天滚动）", () => {
    assert.equal(accessCookieOptions().maxAge, COOKIE_MAX_AGE);
    assert.equal(COOKIE_MAX_AGE, 60 * 60 * 24 * 30);
  });
});
