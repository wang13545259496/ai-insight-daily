import { NextResponse } from "next/server";

import { getPlanById, getPlanOwnerGrant } from "@/lib/agents/travel/data";
import { buildDayMapModel } from "@/lib/agents/travel/daymap-core";
import { renderPlanDayMapPng } from "@/lib/agents/travel/daymap";
import { buildDayMapUrlSafe } from "@/lib/agents/travel/staticmap";
import { canAccessPlan } from "@/lib/travel-access";
import { travelGrantFromRequest } from "@/lib/travel-access-server";

/**
 * 逐日路线图。
 *
 * GET /api/travel/[id]/map?day=2
 *
 * 为什么不直接把高德静态图 URL 写进 <img>：
 *   1. URL 里含 AMAP_WEB_KEY —— 写进 HTML 等于把 Key 发给每个访问者；
 *   2. 高德自己画的编号只有几个像素高，读不出来，也无法加大；
 *   3. 需要叠加编号、路线与方向箭头，这些只能由服务端合成。
 *
 * 兜底：合成失败（未配置 Key、sharp 缺失、取底图超时）时 302 到高德
 * 自己的静态图 URL —— 那张图没有大号编号，但至少不是破图。
 * 兜底响应不缓存，避免把「一次瞬时失败」固化下来。
 */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** 解析并校验天数参数 */
function parseDay(raw: string | null): number | null {
  const value = Number(raw);

  return Number.isInteger(value) && value > 0 ? value : null;
}

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
  const dayNumber = parseDay(new URL(request.url).searchParams.get("day"));

  if (!Number.isInteger(numericId) || numericId <= 0 || dayNumber === null) {
    return NextResponse.json({ success: false, message: "参数无效" }, { status: 400 });
  }

  try {
    // 图片同样要校验归属：否则知道 id 就能看到别人的行程分布
    const ownerGrant = await getPlanOwnerGrant(numericId);

    if (!canAccessPlan(grantId, ownerGrant)) {
      return NextResponse.json({ success: false, message: "方案不存在" }, { status: 404 });
    }

    const plan = await getPlanById(numericId);
    const day = plan?.itinerary.find((item) => item.day === dayNumber);

    if (!plan || !day) {
      return NextResponse.json({ success: false, message: "方案不存在" }, { status: 404 });
    }

    const png = await renderPlanDayMapPng(plan, day);

    if (png) {
      return new NextResponse(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Length": String(png.length),
          // private：行程是私有内容，不允许代理缓存
          "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // ---------- 兜底：交给高德自己画（无大号编号，但至少能看）----------
    const { stops } = buildDayMapModel(day);
    const fallback = buildDayMapUrlSafe(
      stops.map((stop) => ({ location: stop.location, index: stop.number })),
      plan.dayRoutePolylines?.[dayNumber] ?? null,
    );

    if (fallback) {
      const response = NextResponse.redirect(fallback, 302);

      response.headers.set("Cache-Control", "no-store");

      return response;
    }

    return NextResponse.json(
      { success: false, message: "该天缺少坐标，无法生成地图" },
      { status: 404 },
    );
  } catch (error) {
    console.error("[travel] 生成逐日地图失败", { id: numericId, day: dayNumber, error: String(error) });

    return NextResponse.json({ success: false, message: "生成地图失败" }, { status: 500 });
  }
}
