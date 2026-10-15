import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { COOKIE_MAX_AGE, TRAVEL_COOKIE, hasValidAccess, isTravelProtected, travelToken } from "./lib/travel-access";

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
 * 生成「已登录」的响应：写入访问 Cookie。
 *
 * 与校验逻辑共用 lib/travel-access 里的常量，
 * 避免名称或有效期在读写两处不一致。
 */
export async function attachAccessCookie(response: NextResponse): Promise<NextResponse> {
  const token = await travelToken();

  if (!token) return response;

  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set(TRAVEL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    /**
     * secure 只在明确要求时启用。
     *
     * 原因：当前线上经 nginx 走 HTTP，若强制 secure，
     * 浏览器不会回传 cookie，用户会陷入「登录后仍被要求登录」。
     * 等接入 HTTPS 后把 COOKIE_SECURE 设为 1 即可。
     */
    secure: isProduction && process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
