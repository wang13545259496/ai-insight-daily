import { NextResponse } from "next/server";

import { TRAVEL_COOKIE, accessCookieOptions, clearCookieOptions, isTravelProtected, travelToken, verifyPassword } from "@/lib/travel-access";

/**
 * 旅行模块口令的校验与注销。
 * POST /api/travel/auth          登录
 * DELETE /api/travel/auth        退出
 *
 * 放在 /api/travel 下而不在 Proxy 里处理：Proxy 只做页面拦截，
 * 登录是写操作（要下发 Cookie），做成接口更直接，也便于前端给错误提示。
 */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** 只接受站内相对路径，避免被构造成外部跳转 */
function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/travel";

  if (!value.startsWith("/") || value.startsWith("//")) return "/travel";

  return value;
}

export async function POST(request: Request) {
  // 未启用保护时无需登录，直接放行到目标页
  if (!isTravelProtected()) {
    return NextResponse.json({ success: true, message: "未启用访问口令" });
  }

  let body: { password?: unknown; next?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "请求格式不正确" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";

  if (password.length === 0) {
    return NextResponse.json({ success: false, message: "请输入访问口令" }, { status: 400 });
  }

  if (!(await verifyPassword(password))) {
    // 不区分「口令错误」与其它情况，避免给出可枚举的信息
    return NextResponse.json({ success: false, message: "口令不正确" }, { status: 401 });
  }

  const token = await travelToken();

  if (!token) {
    return NextResponse.json({ success: false, message: "服务端未配置口令" }, { status: 500 });
  }

  const response = NextResponse.json({
    success: true,
    next: safeNext(body.next),
  });

  // 属性统一由 lib/travel-access 提供，保证登录、续期、退出三处一致
  response.cookies.set(TRAVEL_COOKIE, token, accessCookieOptions());

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "已退出" });

  // 用 maxAge: 0 清除；path 必须与写入时一致，否则浏览器不会清除
  response.cookies.set(TRAVEL_COOKIE, "", clearCookieOptions());

  return response;
}
