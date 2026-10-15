import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { TRAVEL_COOKIE, accessCookieOptions, hasValidAccess, isTravelProtected } from "./lib/travel-access";

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

/** 旅行登录页路径：必须放行，否则会重定向到自己导致死循环 */
const TRAVEL_LOGIN_PATH = "/travel/login";

/** 是否是受口令保护的旅行页面（不含登录页本身） */
function isProtectedTravelPage(pathname: string): boolean {
  if (pathname === TRAVEL_LOGIN_PATH) return false;

  return pathname === "/travel" || pathname.startsWith("/travel/");
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
  if (isProtectedTravelPage(pathname)) {
    // 未配置口令时完全放行（本地开发与首次部署不会被锁在门外）
    if (isTravelProtected()) {
      const cookie = request.cookies.get(TRAVEL_COOKIE)?.value;

      if (!(await hasValidAccess(cookie))) {
        const url = request.nextUrl.clone();

        url.pathname = TRAVEL_LOGIN_PATH;
        url.search = "";

        // 记住原目标以便登录后跳回。只接受站内相对路径
        // （以单个 / 开头），避免被构造成外部跳转。
        if (pathname.startsWith("/") && !pathname.startsWith("//")) {
          url.searchParams.set("next", pathname + request.nextUrl.search);
        }

        return NextResponse.redirect(url);
      }

      /**
       * 已通过校验：顺带续期。
       *
       * 为什么需要显式续期：Cookie 的过期时间只在**设置它的那一刻**确定，
       * 浏览器不会因为"一直在用"而自动延后。因此若不重设，
       * 无论用得多频繁，满 30 天都会被要求重新输口令。
       * 这里每次通过校验都重下一次，效果是「只要 30 天内有访问就不用重输」，
       * 同时保留「闲置 30 天自动失效」的安全边界。
       *
       * 只重设值、不改属性，属性由 renewAccessCookie 统一处理。
       */
      const response = NextResponse.next();

      renewAccessCookie(response, cookie as string);

      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 接口层：调试接口的生产环境保护
    "/api/:path*",
    // 旅行页面：访问口令。刻意不匹配 /api/travel ——
    // 那些接口在各自路由内校验，因为生成行程是流式响应，
    // 在 Proxy 里统一返回 401 反而更难处理。
    "/travel",
    "/travel/:path*",
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
function renewAccessCookie(response: NextResponse, value: string): void {
  response.cookies.set(TRAVEL_COOKIE, value, accessCookieOptions());
}
