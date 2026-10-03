import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 起 middleware 更名为 proxy，文件名与导出名都必须使用 proxy。
 *
 * 作用：给"调试/测试用"的接口加生产环境保护。
 * 这些接口会触发全量采集、AI 流水线、数据写入等重操作，
 * 一旦在生产环境暴露，任何匿名请求都能触发，属于上线风险。
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
