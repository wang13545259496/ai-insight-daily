/**
 * 旅行模块的访问控制。
 *
 * 需求背景：整个站点里只有旅行模块需要保护，其它页面（首页、情报等）保持公开。
 * 因此不在 nginx 层做认证（那会挡住全站），而是在应用内针对 /agent-travel 做拦截。
 *
 * ## 两种身份
 *
 *   owner   维护者本人。口令是 TRAVEL_PASSWORD，永久有效，能看到所有人的行程。
 *   friend  朋友。用**一次性邀请码**登录，会话 1 天，只能看到自己生成的行程。
 *
 * ## Cookie 格式
 *
 *   owner（以及改造前的旧会话）：<64 位十六进制>         纯 HMAC
 *   friend：                    <grantId>.<64 位十六进制>  身份 + 该身份的 HMAC
 *
 * 为什么保留 owner 的旧格式：改造前只有维护者一个人在用，
 * 线上已经有一个有效 Cookie。让旧格式继续能用，可以避免改完把自己踢下线。
 * 旧格式没有身份前缀，一律视为 owner —— 而它本来也只可能来自维护者。
 *
 * ## 为什么身份可以放在明文里
 *
 * grantId 本身不是秘密（拿不到签名就没用）。签名由 TRAVEL_PASSWORD
 * 作 HMAC 密钥派生，没有口令无法伪造任意 grantId 的有效签名。
 * 这样服务端仍然**无状态**：校验不需要查库。
 *
 * 要注意的边界：无状态意味着**无法单独吊销某个会话**。
 * 好友的行程隔离靠 grantId 区分，但要立刻切断某个好友，
 * 只能改 TRAVEL_PASSWORD（会同时踢掉所有人）。
 * 邀请码本身是一次性的，所以「把码转发给别人」这条路已经堵住了。
 */

/** 会话 Cookie 名 */
export const TRAVEL_COOKIE = "travel_access";

/** 维护者自己的身份标识 */
export const OWNER_GRANT = "owner";

/** 维护者会话有效期（秒）：30 天 */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * 好友会话有效期（秒）：1 天。
 *
 * 好友是「临时来规划一次行程」的场景，不需要长期登录态。
 * 一天之后自然失效，想再用就找维护者要新码。
 */
export const FRIEND_COOKIE_MAX_AGE = 60 * 60 * 24;

/** HMAC 的消息内容。固定值即可，作用是让派生结果与用途绑定 */
const HMAC_MESSAGE = "travel-module-access";

/** 好友令牌签名的消息前缀，与 owner 的派生消息区分开，避免跨用途复用 */
const GRANT_SIGN_PREFIX = "travel-grant";

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
 * 用口令对一个固定消息做 HMAC。
 *
 * @param message 要签的消息
 * @returns 十六进制签名；未配置口令时返回 null
 */
async function hmacHex(message: string): Promise<string | null> {
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

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  return toHex(signature);
}

/**
 * Cookie 是否应带 Secure 标志。
 *
 * 为什么不看 NODE_ENV：线上经 pm2 启动时 NODE_ENV 未必被显式设置，
 * 判断会随启动方式漂移。改为只认一个显式变量 ——
 * 配了 COOKIE_SECURE=1 就加 Secure，否则不加，行为可预测。
 */
export function cookieSecure(): boolean {
  return (process.env.COOKIE_SECURE ?? "").trim() === "1";
}

/**
 * 访问 Cookie 的属性。
 *
 * 集中在这里而不是各处手写：登录、续期、退出三处必须一致 ——
 * 尤其是 path，若退出时 path 与写入时不同，浏览器不会清除该 Cookie。
 */
export const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

/** 某个身份对应的 Cookie 有效期（秒） */
export function cookieMaxAgeFor(grantId: string): number {
  return grantId === OWNER_GRANT ? COOKIE_MAX_AGE : FRIEND_COOKIE_MAX_AGE;
}

/**
 * 生成「已登录」用的 Cookie 属性。
 *
 * @param grantId 身份。省略则按 owner 处理（保持旧调用方的行为不变）
 */
export function accessCookieOptions(grantId: string = OWNER_GRANT) {
  return {
    ...ACCESS_COOKIE_OPTIONS,
    secure: cookieSecure(),
    maxAge: cookieMaxAgeFor(grantId),
  };
}

/** 生成「清除」用的 Cookie 属性（maxAge 为 0） */
export function clearCookieOptions() {
  return {
    ...ACCESS_COOKIE_OPTIONS,
    secure: cookieSecure(),
    maxAge: 0,
  };
}

/**
 * 维护者会话令牌（旧格式，纯 HMAC）。
 *
 * 保留这个函数是为了向后兼容：改造前签发的 Cookie 就是这个值，
 * 继续认它可以让维护者不用重新登录。
 *
 * @returns 令牌；未配置口令时返回 null
 */
export async function travelToken(): Promise<string | null> {
  return hmacHex(HMAC_MESSAGE);
}

/**
 * 为某个身份派生带签名的 Cookie 值。
 *
 * owner 仍返回纯 HMAC（与旧格式一致）；
 * 其它身份返回 `<grantId>.<签名>`。
 *
 * @returns Cookie 值；未配置口令时返回 null
 */
export async function grantToken(grantId: string): Promise<string | null> {
  if (grantId === OWNER_GRANT) {
    return travelToken();
  }

  const signature = await hmacHex(`${GRANT_SIGN_PREFIX}|${grantId}`);

  if (!signature) return null;

  return `${grantId}.${signature}`;
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
 * 解析 Cookie 得到身份。
 *
 * 支持两种格式：
 *   <64 hex>            旧格式 / owner
 *   <grantId>.<64 hex>  带身份的格式
 *
 * @returns 身份标识；未登录或签名不合法时返回 null
 */
export async function parseGrant(
  cookieValue: string | undefined,
): Promise<string | null> {
  if (!cookieValue) return null;

  const dot = cookieValue.lastIndexOf(".");

  // 无点号 → 旧格式，只可能是 owner
  if (dot < 0) {
    const expected = await travelToken();

    if (!expected) return null;

    return safeEqual(cookieValue, expected) ? OWNER_GRANT : null;
  }

  const grantId = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);

  if (!grantId || !signature) return null;

  // owner 的带点格式也接受，便于将来统一
  const expected = await grantToken(grantId);

  if (!expected) return null;

  return safeEqual(cookieValue, expected) ? grantId : null;
}

/**
 * 判断某个身份能否访问某份行程方案。
 *
 * 规则：
 *   · 维护者          看全部（包括 ownerGrant 为 null 的历史数据）
 *   · 好友            只看 ownerGrant 等于自己身份的
 *   · 历史数据(null)  只有维护者能看
 *
 * @param grantId       访问者身份
 * @param planOwnerGrant 方案归属；undefined 表示方案不存在
 */
export function canAccessPlan(
  grantId: string | null,
  planOwnerGrant: string | null | undefined,
): boolean {
  if (!grantId) return false;

  if (grantId === OWNER_GRANT) return true;

  // 方案不存在，或属于别人 / 属于历史数据 —— 都不可访问
  return planOwnerGrant === grantId;
}

/**
 * 判断请求是否已通过口令。
 *
 * @param cookieValue 请求携带的 travel_access cookie
 */
export async function hasValidAccess(cookieValue: string | undefined): Promise<boolean> {
  // 未启用保护时一律放行
  if (!isTravelProtected()) return true;

  return (await parseGrant(cookieValue)) !== null;
}

/**
 * 是否为「已登录」状态。
 *
 * 与 hasValidAccess 的区别：后者把「未启用保护」也算作通过，
 * 而调用方有时需要区分这两种情况 —— 例如同一页面上
 * 「表单对所有人公开」但「历史方案仅登录者可见」。
 *
 * 未启用保护时视为已登录（不存在登录这回事，所有人都能看）。
 */
export async function isTravelAuthed(cookieValue: string | undefined): Promise<boolean> {
  if (!isTravelProtected()) return true;

  return (await parseGrant(cookieValue)) !== null;
}
