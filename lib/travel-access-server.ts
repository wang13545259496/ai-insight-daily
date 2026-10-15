import { NextResponse } from "next/server";

import { TRAVEL_COOKIE, hasValidAccess } from "./travel-access";

/**
 * 旅行接口的访问校验。
 *
 * 为什么接口要单独校验而不交给 Proxy：生成行程是流式响应（SSE），
 * 在 Proxy 层统一拦截会让「已开始输出后才发现未授权」难以处理。
 * 接口内校验可以在写入任何数据前就返回 401。
 *
 * 用法：
 *   const denied = await requireTravelAccess(request);
 *   if (denied) return denied;
 */
export async function requireTravelAccess(request: Request): Promise<NextResponse | null> {
  // 从 Cookie 头解析（接口内拿不到 NextRequest 的 cookies 便捷方法）
  const cookieHeader = request.headers.get("cookie") ?? "";

  const value = readCookie(cookieHeader, TRAVEL_COOKIE);

  if (await hasValidAccess(value)) return null;

  return NextResponse.json(
    { success: false, message: "需要访问口令", code: "TRAVEL_AUTH_REQUIRED" },
    { status: 401 },
  );
}

/** 从 Cookie 头里取指定名字的值 */
function readCookie(header: string, name: string): string | undefined {
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const trimmed = part.trim();

    if (!trimmed.startsWith(name + "=")) continue;

    const raw = trimmed.slice(name.length + 1);

    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  return undefined;
}
