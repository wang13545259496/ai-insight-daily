import { NextResponse } from "next/server";

import { CityResolveError } from "@/lib/agents/travel/cities";
import {
  deletePlanById,
  findPlanByFingerprint,
  listPlans,
  resolveQuoteMode,
  savePlan,
} from "@/lib/agents/travel/data";
import { generateTravelPlan, type PlanProgressReporter } from "@/lib/agents/travel/planner";
import { TravelValidationError } from "@/lib/agents/travel/validation";
import { requireTravelAccess } from "@/lib/travel-access-server";

/**
 * 旅行方案接口。
 *
 * POST /api/travel/plan  由表单输入生成方案并落库
 *                        Accept: application/x-ndjson 时改为流式返回进度
 * GET  /api/travel/plan  读取历史方案列表
 *
 * 为什么支持流式：一次生成要调用模型并发出数十次地图请求，实测约
 * 40-60 秒。普通 JSON 响应期间页面完全无反馈，用户会以为卡死。
 * 流式返回后，每完成一个阶段就推一行 JSON，前端可实时显示进度。
 *
 * 错误约定与本项目其它接口一致：{ success, message }。
 * 校验类错误返回 400 并把逐条原因放在 errors 里，方便表单逐项提示。
 */

/** 生成单次请求可能耗时较久（询价 + 模型 + 地图），显式声明运行时 */
export const runtime = "nodejs";

/** 避免构建时静态化：该路由依赖数据库与外部接口 */
export const dynamic = "force-dynamic";

/** 流式响应的总时长上限（毫秒），防止连接被永久占用 */
const STREAM_TIMEOUT_MS = 180_000;

/** 把对象编码成一行 NDJSON */
function ndjson(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

export async function POST(request: Request) {
  /**
   * 访问校验放在最前：生成行程会消耗模型与地图配额，
   * 必须在做任何工作之前拦截，而不是等流式输出开始后才发现未授权。
   */
  const denied = await requireTravelAccess(request);

  if (denied) return denied;

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

  // 客户端要求流式进度时走流式分支
  const wantsStream = (request.headers.get("accept") ?? "").includes("application/x-ndjson");

  if (wantsStream) {
    return streamPlan(payload);
  }

  try {
    const result = await runGenerate(payload);

    return NextResponse.json(result);
  } catch (error) {
    const payloadOut = toErrorPayload(error);

    const status =
      error instanceof TravelValidationError || error instanceof CityResolveError ? 400 : 500;

    return NextResponse.json(payloadOut, { status });
  }
}

/**
 * 流式生成：每完成一个阶段推一行 NDJSON。
 *
 * 协议：
 *   {"type":"progress","stage":"map","message":"正在获取景点坐标与真实通勤"}
 *   {"type":"done","success":true,"data":{...},"id":12,"quoteMode":"estimate","warnings":[...]}
 *   {"type":"done","success":false,"message":"...","errors":[...]}
 *
 * 用 NDJSON 而不是 SSE：POST 请求用 SSE 需要 EventSource，而它不支持
 * POST，改用 fetch + ReadableStream 读 NDJSON 更直接，也不需要心跳包。
 */
function streamPlan(payload: Record<string, unknown>): Response {
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const push = (value: unknown): void => {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(ndjson(value));
        } catch {
          // 客户端已断开：标记关闭，后续写入静默忽略
          closed = true;
        }
      };

      const onProgress: PlanProgressReporter = (stage, message) => {
        push({ type: "progress", stage, message });
      };

      // 兜底：即使生成卡住，也在超时后关闭连接，避免连接被长期占用
      const timer = setTimeout(() => {
        push({ type: "done", success: false, message: "生成超时，请稍后重试或缩短行程天数" });
        closed = true;
        controller.close();
      }, STREAM_TIMEOUT_MS);

      try {
        const result = await runGenerate(payload, onProgress);

        clearTimeout(timer);
        push({ type: "done", ...result });
        controller.close();
      } catch (error) {
        clearTimeout(timer);

        push({ type: "done", ...toErrorPayload(error) });
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // 关闭 Nginx 缓冲，确保每一行立即到达浏览器
      "X-Accel-Buffering": "no",
    },
  });
}

/** 把异常转成统一的可返回载荷 */
function toErrorPayload(error: unknown): {
  success: false;
  message: string;
  errors: string[];
} {
  if (error instanceof TravelValidationError) {
    return { success: false, message: "输入有误，请检查表单", errors: error.errors };
  }

  if (error instanceof CityResolveError) {
    return { success: false, message: error.message, errors: [error.message] };
  }

  console.error("[travel] 生成方案失败", { error: String(error) });

  return {
    success: false,
    message: "生成方案失败，请稍后重试",
    errors: [error instanceof Error ? error.message : String(error)],
  };
}

/**
 * 生成并落库，返回可直接下发的载荷。
 * 普通响应与流式响应共用这一段，避免两套逻辑走偏。
 */
async function runGenerate(
  payload: Record<string, unknown>,
  onProgress?: PlanProgressReporter,
): Promise<{
  success: true;
  data: unknown;
  id: number | null;
  quoteMode: string;
  warnings: string[];
  deduplicated: boolean;
}> {
  const { plan, warnings, fingerprint } = await generateTravelPlan(payload, new Date(), onProgress);

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

  return { success: true, data: plan, id, quoteMode, warnings, deduplicated };
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
