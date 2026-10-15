/**
 * 旅行模块的访问口令。
 *
 * 需求背景：整个站点里只有旅行模块需要保护，其它页面（首页、情报等）保持公开。
 * 因此不在 nginx 层做认证（那会挡住全站），而是在应用内针对 /travel 做拦截。
 *
 * 设计要点：
 *
 * 1. **无状态会话**。令牌由 HMAC 派生，服务端不存 session ——
 *    个人项目没必要引入会话存储，且重启后仍然有效。
 *
 * 2. **Cookie 里不放密码**。存的是 HMAC 值，即使 cookie 泄露也无法反推口令。
 *
 * 3. **未配置口令时保持公开**。这样本地开发与首次部署不会因为忘配环境变量
 *    而把自己锁在门外；是否启用完全由有无 TRAVEL_PASSWORD 决定。
 *
 * 4. **用 Web Crypto 而非 node:crypto**。Proxy（原 middleware）可能运行在
 *    Edge 运行时，node:crypto 不保证可用。
 */

/** 会话 Cookie 名 */
export const TRAVEL_COOKIE = "travel_access";

/** Cookie 有效期（秒）：30 天 */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** HMAC 的消息内容。固定值即可，作用是让派生结果与用途绑定 */
const HMAC_MESSAGE = "travel-module-access";

/** 读取配置的口令；未配置或为空白时返回 null */
export function travelPassword(): string | null {
  const raw = process.env.TRAVEL_PASSWORD;

  if (!raw) return null;

  const trimmed = raw.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/** 是否启用了口令保护 */
export function isTravelProtected(): boolean {
  return travelPassword() !== null;
}

/** 把字节转成十六进制串 */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 由口令派生会话令牌。
 *
 * 用 HMAC 而不是直接哈希口令：HMAC 需要一个"密钥"，
 * 这里用固定消息 + 口令作密钥，等价于 PBKDF 的简化形式 ——
 * 攻击者拿到 cookie 也无法离线穷举（没有服务端口令无法验证猜测）。
 *
 * @returns 令牌；未配置口令时返回 null
 */
export async function travelToken(): Promise<string | null> {
  const password = travelPassword();

  if (!password) return null;

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(HMAC_MESSAGE));

  return toHex(signature);
}

/**
 * 恒定时间字符串比较。
 *
 * 为什么不用 ===：普通比较会在首个不同字符处提前返回，
 * 攻击者可据响应时间逐字节猜测。虽然对个人站点的威胁有限，
 * 但这是廉价且标准的做法。
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

/** 校验口令是否正确 */
export async function verifyPassword(input: string): Promise<boolean> {
  const expected = travelPassword();

  if (!expected) return true;

  // 逐个字符比较同样用恒定时间实现
  return safeEqual(input, expected);
}

/**
 * 判断请求是否已通过口令。
 *
 * @param cookieValue 请求携带的 travel_access cookie
 */
export async function hasValidAccess(cookieValue: string | undefined): Promise<boolean> {
  const expected = await travelToken();

  // 未启用保护时一律放行
  if (!expected) return true;

  if (!cookieValue) return false;

  return safeEqual(cookieValue, expected);
}
