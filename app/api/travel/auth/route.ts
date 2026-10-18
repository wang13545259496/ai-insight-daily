import { NextResponse } from "next/server";

import {
  OWNER_GRANT,
  TRAVEL_COOKIE,
  accessCookieOptions,
  clearCookieOptions,
  isTravelProtected,
  grantToken,
  verifyPassword,
} from "@/lib/travel-access";
import { consumeInvite, looksLikeInviteCode } from "@/lib/travel-invite";

/**
 * 旅行模块的登录与注销。
 *
 * POST   /api/travel/auth   登录（口令 或 一次性邀请码）
 * DELETE /api/travel/auth   退出
 *
 * 放在 /api/travel 下而不在 Proxy 里处理：Proxy 只做页面拦截，
 * 登录是写操作（要下发 Cookie），做成接口更直接，也便于前端给错误提示。
 *
 * ## 两种登录方式
 *
 *   口令（维护者）    body: { password }
 *                    永久有效，会话 30 天，能看到所有人的行程。
 *
 *   邀请码（好友）    body: { code }
 *                    只能用一次，会话 1 天，只能看到自己生成的行程。
 *
 * 两者走同一个接口，靠 body 里有哪个字段区分。不用两个接口是因为
 * 登录页只有一个输入框 —— 用户不会关心自己输入的是哪种，
 * 让它自动判断比让用户选「我是主人还是访客」更自然。
 */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** 只接受站内相对路径，避免被构造成外部跳转 */
function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/travel";

  if (!value.startsWith("/") || value.startsWith("//")) return "/travel";

  return value;
}

/** 取请求来源 IP 的尾段，够排查异常即可，不存完整地址 */
function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();

  const raw = first || request.headers.get("x-real-ip") || "";

  if (!raw) return null;

  // IPv4 只留后两段，IPv6 只留最后一组，降低隐私敏感度
  const parts = raw.split(".");

  if (parts.length === 4) return `*.*.${parts[2]}.${parts[3]}`;

  return raw.slice(-24);
}

export async function POST(request: Request) {
  // 未启用保护时无需登录，直接放行到目标页
  if (!isTravelProtected()) {
    return NextResponse.json({ success: true, message: "未启用访问口令" });
  }

  let body: { credential?: unknown; password?: unknown; code?: unknown; next?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "请求格式不正确" }, { status: 400 });
  }

  /**
   * 登录表单只有一个输入框，提交的是 credential。
   * 这里按格式判断它是邀请码还是口令 ——
   * 让用户自己选「我是主人还是访客」既多余又容易选错。
   *
   * 同时保留 code / password 两个字段，供脚本与测试直接调用。
   */
  const credential = typeof body.credential === "string" ? body.credential.trim() : "";

  const code = credential
    ? looksLikeInviteCode(credential)
      ? credential
      : ""
    : typeof body.code === "string"
      ? body.code.trim()
      : "";

  const password = credential
    ? looksLikeInviteCode(credential)
      ? ""
      : credential
    : typeof body.password === "string"
      ? body.password
      : "";

  // ---------- 邀请码登录 ----------
  if (code.length > 0) {
    const grantId = await consumeInvite(code, clientIp(request));

    if (!grantId) {
      // 不区分「码不存在」「已使用」「已过期」——
      // 分开提示等于给出一个可枚举的探测接口
      return NextResponse.json(
        { success: false, message: "码无效或已被使用", code: "INVITE_INVALID" },
        { status: 401 },
      );
    }

    const token = await grantToken(grantId);

    if (!token) {
      return NextResponse.json({ success: false, message: "服务端未配置口令" }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      next: safeNext(body.next),
      // 前端据此显示「有效期 1 天」之类的提示
      grant: "friend",
    });

    response.cookies.set(TRAVEL_COOKIE, token, accessCookieOptions(grantId));

    return response;
  }

  // ---------- 口令登录（维护者） ----------
  if (password.length === 0) {
    return NextResponse.json(
      { success: false, message: "请输入访问口令或邀请码" },
      { status: 400 },
    );
  }

  if (!(await verifyPassword(password))) {
    // 不区分「口令错误」与其它情况，避免给出可枚举的信息
    return NextResponse.json({ success: false, message: "口令不正确" }, { status: 401 });
  }

  const token = await grantToken(OWNER_GRANT);

  if (!token) {
    return NextResponse.json({ success: false, message: "服务端未配置口令" }, { status: 500 });
  }

  const response = NextResponse.json({
    success: true,
    next: safeNext(body.next),
    grant: "owner",
  });

  // 属性统一由 lib/travel-access 提供，保证登录、续期、退出三处一致
  response.cookies.set(TRAVEL_COOKIE, token, accessCookieOptions(OWNER_GRANT));

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "已退出" });

  // 用 maxAge: 0 清除；path 必须与写入时一致，否则浏览器不会清除
  response.cookies.set(TRAVEL_COOKIE, "", clearCookieOptions());

  return response;
}
