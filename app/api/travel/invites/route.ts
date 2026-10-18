import { NextResponse } from "next/server";

import { OWNER_GRANT } from "@/lib/travel-access";
import { travelGrantFromRequest } from "@/lib/travel-access-server";
import { createInvite, listInvites, revokeInvite, revokeInviteById } from "@/lib/travel-invite";

/**
 * 邀请码管理接口。
 *
 *   GET    /api/travel/invites            列出所有码
 *   POST   /api/travel/invites            生成一个码
 *   DELETE /api/travel/invites?code=...   撤销未使用的码
 *
 * ## 只允许维护者
 *
 * 这里判断的是「是不是 owner」，不是「有没有登录」——
 * 好友是登录状态，但绝不能生成码。
 *
 * 为什么不做额外的管理口令：生成码所需的权限，与查看全部行程完全相同。
 * 能进这里的人本来就能看到所有人的数据，多设一道口令不增加实际安全性，
 * 只增加遗忘口令的风险。
 *
 * ## 为什么不记录操作日志
 *
 * 单用户系统，能进来的人只有一个。日志的价值低于维护成本。
 */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** 统一的未授权响应 */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, message: "需要维护者权限", code: "TRAVEL_OWNER_REQUIRED" },
    { status: 403 },
  );
}

/** 取当前身份并确认是维护者 */
async function requireOwner(request: Request): Promise<NextResponse | null> {
  const grantId = await travelGrantFromRequest(request);

  if (grantId !== OWNER_GRANT) {
    return unauthorized();
  }

  return null;
}

export async function GET(request: Request) {
  const denied = await requireOwner(request);

  if (denied) return denied;

  try {
    const rows = await listInvites();

    // 只回传状态，不含哈希
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        usedAt: r.usedAt ? r.usedAt.toISOString() : null,
        usedIp: r.usedIp,
      })),
    });
  } catch (error) {
    console.error("[travel] 读取邀请码失败", { error: String(error) });

    return NextResponse.json({ success: false, message: "读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireOwner(request);

  if (denied) return denied;

  let body: { note?: unknown; days?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "请求格式不正确" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  const daysRaw = Number(body.days);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.floor(daysRaw), 30) : 1;

  if (!note) {
    return NextResponse.json({ success: false, message: "请填写备注" }, { status: 400 });
  }

  if (note.length > 40) {
    return NextResponse.json({ success: false, message: "备注最多 40 字" }, { status: 400 });
  }

  try {
    const invite = await createInvite({ note, days });

    /**
     * 明文码只在这里返回一次 —— 数据库里存的是哈希。
     * 前端必须把它显示出来并允许复制，刷新后无法再取回。
     */
    return NextResponse.json({
      success: true,
      code: invite.code,
      expiresAt: invite.expiresAt.toISOString(),
      days,
      note,
    });
  } catch (error) {
    console.error("[travel] 生成邀请码失败", { error: String(error) });

    return NextResponse.json({ success: false, message: "生成失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireOwner(request);

  if (denied) return denied;

  /**
   * 两种定位方式：
   *   ?code=TRV-XXXX-XXXX  命令行用（人为输入一个码）
   *   ?id=123              页面用（列表不返回明文，只有 id）
   */
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  const idRaw = url.searchParams.get("id");
  const id = idRaw ? Number(idRaw) : NaN;

  if (!code && !Number.isInteger(id)) {
    return NextResponse.json(
      { success: false, message: "缺少 code 或 id 参数" },
      { status: 400 },
    );
  }

  try {
    const revoked = code ? await revokeInvite(code) : await revokeInviteById(id);

    if (!revoked) {
      return NextResponse.json(
        { success: false, message: "撤销失败：码不存在或已被使用" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[travel] 撤销邀请码失败", { error: String(error) });

    return NextResponse.json({ success: false, message: "撤销失败" }, { status: 500 });
  }
}
