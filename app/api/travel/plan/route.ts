import { NextResponse } from "next/server";

import { CityResolveError } from "@/lib/agents/travel/cities";
import {
  deletePlanById,
  findPlanByFingerprint,
  listPlans,
  resolveQuoteMode,
  savePlan,
} from "@/lib/agents/travel/data";
import { generateTravelPlan } from "@/lib/agents/travel/planner";
import { TravelValidationError } from "@/lib/agents/travel/validation";

/**
 * 旅行方案接口。
 *
 * POST /api/travel/plan  由表单输入生成方案并落库
 * GET  /api/travel/plan  读取历史方案列表
 *
 * 错误约定与本项目其它接口一致：{ success, message }。
 * 校验类错误返回 400 并把逐条原因放在 errors 里，方便表单逐项提示。
 */

/** 生成单次请求可能耗时较久（询价 + 模型），显式声明运行时 */
export const runtime = "nodejs";

/** 避免构建时静态化：该路由依赖数据库与外部接口 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "请求体不是合法 JSON" },
      { status: 400 },
    );
  }

  // 支持 { regenerateFrom: id } 形式：用历史方案的需求重新生成一份
  const payload =
    typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  try {
    const { plan, warnings, fingerprint } = await generateTravelPlan(payload);

    const quoteMode = resolveQuoteMode(plan);

    let id: number | null = null;
    let deduplicated = false;

    try {
      // 同一需求重复提交时覆盖旧记录：fingerprint 列有唯一索引，
      // 不先清理会直接冲突。这样既避免重复消耗模型与地图配额，
      // 又保证「重新生成」拿到的是最新结果。
      const existing = await findPlanByFingerprint(fingerprint);

      if (existing) {
        await deletePlanById(existing.id);
        deduplicated = true;
        warnings.push("该需求已有历史方案，本次已用最新生成结果替换旧记录");
      }

      id = await savePlan({ plan, quoteMode });
    } catch (error) {
      // 落库失败不应让用户丢掉刚生成的方案：照常返回，仅提示未保存
      console.error("[travel] 方案落库失败", { error: String(error) });

      warnings.push("方案未能保存到历史记录，仍可正常查看与分享当前结果");
    }

    return NextResponse.json({
      success: true,
      data: plan,
      id,
      quoteMode,
      warnings,
      deduplicated,
    });
  } catch (error) {
    if (error instanceof TravelValidationError) {
      return NextResponse.json(
        { success: false, message: "输入有误，请检查表单", errors: error.errors },
        { status: 400 },
      );
    }

    if (error instanceof CityResolveError) {
      return NextResponse.json(
        { success: false, message: error.message, errors: [error.message] },
        { status: 400 },
      );
    }

    console.error("[travel] 生成方案失败", { error: String(error) });

    return NextResponse.json(
      {
        success: false,
        message: "生成方案失败，请稍后重试",
        errors: [error instanceof Error ? error.message : String(error)],
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "20");

  try {
    const items = await listPlans(Number.isFinite(limitParam) ? limitParam : 20);

    return NextResponse.json({ success: true, data: items, total: items.length });
  } catch (error) {
    console.error("[travel] 读取历史方案失败", { error: String(error) });

    return NextResponse.json(
      { success: false, message: "读取历史方案失败" },
      { status: 500 },
    );
  }
}
