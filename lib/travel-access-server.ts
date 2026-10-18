import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  OWNER_GRANT,
  TRAVEL_COOKIE,
  hasValidAccess,
  isTravelProtected,
  parseGrant,
} from "./travel-access";

/**
 * 旅行接口与服务端组件的访问校验。
 *
 * 为什么接口要单独校验而不交给 Proxy：生成行程是流式响应（NDJSON），
 * 在 Proxy 层统一拦截会让「已开始输出后才发现未授权」难以处理。
 * 接口内校验可以在写入任何数据前就返回 401。
 *
 * ## 两种查询方式
 *
 *   requireTravelAccess(request)  只判断有没有登录（返回 401 或 null）
 *   travelGrantFromRequest(request)  拿到身份，用于行程隔离与限流
 *
 * 需要区分身份的接口（生成、列表、详情）用后者 ——
 * 因为「已登录」还不够，得知道是谁，才能决定他能看到哪些数据。
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

/**
 * 从请求里解析出身份。
 *
 * @returns 身份标识；未登录或签名不合法时为 null。
 *          未启用口令保护时返回 OWNER_GRANT —— 此时不存在登录，
 *          所有人都按「维护者」对待，与改造前的行为一致。
 */
export async function travelGrantFromRequest(request: Request): Promise<string | null> {
  if (!isTravelProtected()) return OWNER_GRANT;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const value = readCookie(cookieHeader, TRAVEL_COOKIE);

  return parseGrant(value);
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

  return parseGrant(store.get(TRAVEL_COOKIE)?.value) !== null;
}

/**
 * 服务端组件用：拿到当前访问者身份。
 *
 * 页面据此决定「历史方案列表显示哪些」——
 * 好友只看自己的，维护者看全部。
 */
export async function currentTravelGrant(): Promise<string | null> {
  const store = await cookies();

  return parseGrant(store.get(TRAVEL_COOKIE)?.value);
}
