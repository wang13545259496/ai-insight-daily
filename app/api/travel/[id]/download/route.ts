import { NextResponse } from "next/server";

import { getPlanById } from "@/lib/agents/travel/data";
import { buildPlanDocument, documentFileName } from "@/lib/agents/travel/export";
import type { ExportOptions } from "@/lib/agents/travel/export";
import { renderPlanDocx } from "@/lib/agents/travel/exportDocx";
import { fetchDayMapImages } from "@/lib/agents/travel/exportImages";
import { requireTravelAccess } from "@/lib/travel-access-server";

/**
 * 旅行方案下载。
 * GET /api/travel/[id]/download
 *
 * 查询参数：
 *   mode=full|compact|day   导出模式，默认 full
 *   day=N                   mode=day 时指定第几天
 *   maps=0                  不嵌入逐日路线图（默认嵌入）
 *
 * 返回 .docx 而非 PDF：中文字体是硬约束 —— PDF 方案必须嵌入 TTF
 * （中文子集通常 10MB 以上），而 Word 文档由阅读端提供字体，
 * 体积小且可编辑。用户如需 PDF，用 Word / WPS 导出即可。
 */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** 从查询参数解析导出选项 */
function parseOptions(url: URL): ExportOptions {
  const modeRaw = (url.searchParams.get("mode") || "").trim().toLowerCase();
  const dayRaw = (url.searchParams.get("day") || "").trim();

  const mode = modeRaw === "compact" || modeRaw === "day" ? modeRaw : "full";

  const day = Number.parseInt(dayRaw, 10);

  return {
    mode,
    day: Number.isInteger(day) && day > 0 ? day : undefined,
    includeMaps: url.searchParams.get("maps") !== "0",
  };
}

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

    const options = parseOptions(new URL(request.url));
    const doc = buildPlanDocument(plan, options);

    // 单日模式只取那一天的图，避免为一张文档拉全部地图
    const wantedDays =
      doc.options.mode === "day" && doc.options.day !== null ? [doc.options.day] : undefined;

    let images: Awaited<ReturnType<typeof fetchDayMapImages>>["images"] = [];

    if (doc.options.includeMaps) {
      const result = await fetchDayMapImages(plan, wantedDays);
      images = result.images;
    }

    const buffer = await renderPlanDocx(doc, images);

    const fileName = documentFileName(plan, options);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        // 文件名含中文，需用 RFC 5987 的 filename* 形式，
        // 否则部分浏览器会得到乱码文件名
        "Content-Disposition": `attachment; filename="trip-plan.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(buffer.length),
        // 方案可被覆盖（同一需求的重新生成），因此不缓存
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[travel] 导出方案失败", { id: numericId, error: String(error) });

    return NextResponse.json({ success: false, message: "导出方案失败" }, { status: 500 });
  }
}
