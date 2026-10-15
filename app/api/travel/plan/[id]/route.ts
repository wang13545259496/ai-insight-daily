import { NextResponse } from "next/server";

import { getPlanById } from "@/lib/agents/travel/data";
import { requireTravelAccess } from "@/lib/travel-access-server";

/**
 * 单份旅行方案接口。
 * GET /api/travel/plan/:id
 */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireTravelAccess(request);

  if (denied) return denied;

  const { id } = await context.params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ success: false, message: "方案编号无效" }, { status: 400 });
  }

  try {
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
