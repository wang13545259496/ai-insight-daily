import { NextResponse } from "next/server";

import { getPlanById, getPlanOwnerGrant } from "@/lib/agents/travel/data";
import { canAccessPlan } from "@/lib/travel-access";
import { travelGrantFromRequest } from "@/lib/travel-access-server";

/**
 * 单份旅行方案接口。
 * GET /api/travel/plan/:id
 */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const grantId = await travelGrantFromRequest(request);

  if (!grantId) {
    return NextResponse.json(
      { success: false, message: "需要访问口令", code: "TRAVEL_AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ success: false, message: "方案编号无效" }, { status: 400 });
  }

  try {
    // 先查归属再取内容：不是自己的一律按「不存在」处理，
    // 避免用 403 泄露「这个 id 确实有方案」
    const ownerGrant = await getPlanOwnerGrant(numericId);

    if (!canAccessPlan(grantId, ownerGrant)) {
      return NextResponse.json({ success: false, message: "方案不存在" }, { status: 404 });
    }

    const plan = await getPlanById(numericId);

    if (!plan) {
      return NextResponse.json({ success: false, message: "方案不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error("[travel] 读取方案失败", { id: numericId, error: String(error) });

    return NextResponse.json({ success: false, message: "读取方案失败" }, { status: 500 });
  }
}
