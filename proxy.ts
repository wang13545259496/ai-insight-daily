import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { OWNER_GRANT, TRAVEL_COOKIE, accessCookieOptions, isTravelProtected, parseGrant } from "./lib/travel-access";

/**
 * Next.js 16 起 middleware 更名为 proxy，文件名与导出名都必须使用 proxy。
 *
 * 本文件承担两类彼此独立的拦截，按顺序判断：
 *
 *   1. 生产环境禁用调试接口 —— 这些接口会触发全量采集、AI 流水线、
 *      数据写入等重操作，一旦在生产暴露，任何匿名请求都能触发。
 *
 *   2. 旅行模块的访问口令 —— 站点只有这个模块需要保护，
 *      其它页面保持公开，因此不在 nginx 层做认证（那会挡住全站）。
 */

/** 需要在生产环境禁用的接口前缀 */
const TEST_ONLY_PREFIXES = [
  "/api/test",
  "/api/ai/test",
  "/api/rss-test",
];

function isTestOnlyRoute(pathname: string): boolean {
  return TEST_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

/** 出行管家登录页路径 */
const TRAVEL_LOGIN_PATH = "/agent-travel/login";

/**
 * 是否属于出行管家的页面（含登录页）。
 *
 * 不再用于拦截，只用于判断「是否需要检查续期」——
 * 登录页本身不必续期（那时还没登录）。
 */
/**
 * 是否为邀请码管理页。
 *
 * 这个页面只允许维护者访问，且必须在**渲染之前**就拒绝 ——
 * 页面内的 redirect()/notFound() 在流式输出开始后改不了状态码，
 * 只能靠浏览器端跳转，curl 和服务端日志看到的仍是 200。
 */
function isTravelInvitesPath(pathname: string): boolean {
  return pathname === "/agent-travel/invites" || pathname.startsWith("/agent-travel/invites/");
}

function isTravelPage(pathname: string): boolean {
  if (pathname === TRAVEL_LOGIN_PATH) return false;

  return pathname === "/agent-travel" || pathname.startsWith("/agent-travel/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---------- 1. 生产环境禁用调试接口 ----------
  if (isTestOnlyRoute(pathname)) {
    const isProduction = process.env.NODE_ENV === "production";

    // 本地开发/调试始终放行；生产环境需显式设置 ENABLE_TEST_API=true 才放行
    const explicitlyEnabled = process.env.ENABLE_TEST_API === "true";

    if (isProduction && !explicitlyEnabled) {
      return NextResponse.json(
        {
          success: false,
          message: "该调试接口已在生产环境禁用",
        },
        { status: 404 },
      );
    }
  }

  // ---------- 2. 旅行模块访问口令 ----------
  /**
   * 页面不再拦截，改为「页面公开、生成需登录」。
   *
   * 为什么改：原先一进 /travel 就要求输口令，用户在还没看到模块内容时
   * 就撞上登录墙。现在可以浏览页面、填写表单，点「生成」时才要求登录 ——
   * 此时用户已经投入了填写成本，转化更自然。
   *
   * 实际的门禁在两处：
   *   · /api/travel/plan 的生成接口（各自路由内校验，返回 401）
   *   · 历史方案列表（服务端按登录态决定是否渲染）
   *
   * Proxy 这里只保留一件事：**已登录时顺带续期 Cookie**。
   */
  if (isTravelPage(pathname) && isTravelProtected()) {
    const cookie = request.cookies.get(TRAVEL_COOKIE)?.value;

    // 解析出身份：续期时要按身份决定有效期 ——
    // 维护者 30 天，好友 1 天。都用默认值会把好友的会话续成 30 天。
    const grantId = await parseGrant(cookie);

    /**
     * 邀请码管理页：仅维护者。
     *
     * 放在续期之前，且返回真正的 307 / 404 ——
     * 页面内的检查在流式渲染开始后无法改变状态码。
     */
    if (isTravelInvitesPath(pathname)) {
      if (!grantId) {
        const loginUrl = request.nextUrl.clone();

        loginUrl.pathname = "/agent-travel/login";
        loginUrl.search = "?next=/agent-travel/invites";

        return NextResponse.redirect(loginUrl);
      }

      // 好友访问按「不存在」处理，不暴露管理页的存在
      if (grantId !== OWNER_GRANT) {
        return new NextResponse("Not Found", { status: 404 });
      }
    }

    if (cookie && grantId) {
      /**
       * 为什么需要显式续期：Cookie 的过期时间只在设置它的那一刻确定，
       * 浏览器不会因为"一直在用"而自动延后。若不重设，
       * 无论用得多频繁，满 30 天都会被要求重新输口令。
       * 这里每次访问都重下一次，效果是「只要 30 天内有访问就不用重输」，
       * 同时保留「闲置 30 天自动失效」的安全边界。
       */
      const response = NextResponse.next();

      renewAccessCookie(response, cookie, grantId);

      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 接口层：调试接口的生产环境保护
    "/api/:path*",
    // 出行管家页面：已登录时续期 Cookie。刻意不匹配 /api/travel ——
    // 那些接口在各自路由内校验，因为生成行程是流式响应，
    // 在 Proxy 里统一返回 401 反而更难处理。
    "/agent-travel",
    "/agent-travel/:path*",
  ],
};

/**
 * 续期访问 Cookie。
 *
 * 用同一个令牌值重下一次，仅刷新过期时间 ——
 * 令牌由 HMAC 派生且与时间无关，因此无需重新计算或轮换。
 *
 * @param value 当前 Cookie 值（已通过校验，必定非空）
 */
function renewAccessCookie(
  response: NextResponse,
  value: string,
  grantId: string,
): void {
  // 有效期跟着身份走：好友续期后仍是 1 天，不会因为反复访问被续成 30 天
  response.cookies.set(TRAVEL_COOKIE, value, accessCookieOptions(grantId));
}
