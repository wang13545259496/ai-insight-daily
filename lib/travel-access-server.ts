import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { TRAVEL_COOKIE, hasValidAccess, isTravelAuthed } from "./travel-access";

/**
 * 旅行接口与服务端组件的访问校验。
 *
 * 为什么接口要单独校验而不交给 Proxy：生成行程是流式响应（NDJSON），
 * 在 Proxy 层统一拦截会让「已开始输出后才发现未授权」难以处理。
 * 接口内校验可以在写入任何数据前就返回 401。
 *
 * 用法（接口）：
 *   const denied = await requireTravelAccess(request);
 *   if (denied) return denied;
 *
 * 用法（服务端组件）：
 *   const authed = await isRequestAuthed();
 */

/** 从 Cookie 头里取指定名字的值 */
export function readCookie(header: string, name: string): string | undefined {
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

/** 接口用：未通过校验时返回 401 响应，通过则返回 null */
export async function requireTravelAccess(request: Request): Promise<NextResponse | null> {
  // 从 Cookie 头解析（接口内拿不到 NextRequest 的 cookies 便捷方法）
  const cookieHeader = request.headers.get("cookie") ?? "";

  const value = readCookie(cookieHeader, TRAVEL_COOKIE);

  if (await hasValidAccess(value)) return null;

  return NextResponse.json(
    {
      success: false,
      message: "需要访问口令",
      // 前端据此判断该跳登录页，而不是显示普通错误
      code: "TRAVEL_AUTH_REQUIRED",
    },
    { status: 401 },
  );
}

/**
 * 服务端组件用：判断当前请求是否为已登录状态。
 *
 * 与 requireTravelAccess 的分工：那个面向接口（返回 401 响应），
 * 这个面向页面渲染（返回布尔值，供决定显示哪部分内容）。
 */
export async function isRequestAuthed(): Promise<boolean> {
  const store = await cookies();

  return isTravelAuthed(store.get(TRAVEL_COOKIE)?.value);
}
