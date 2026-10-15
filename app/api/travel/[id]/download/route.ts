import { NextResponse } from "next/server";

import { getPlanById } from "@/lib/agents/travel/data";
import { buildPlanDocument, documentFileName } from "@/lib/agents/travel/export";
import { renderPlanDocx } from "@/lib/agents/travel/exportDocx";

/**
 * 旅行方案下载。
 * GET /api/travel/[id]/download
 *
 * 返回 .docx 而非 PDF：中文字体是硬约束 —— PDF 方案必须嵌入 TTF
 * （中文子集通常 10MB 以上），而 Word 文档由阅读端提供字体，
 * 体积小且可编辑。用户如需 PDF，用 Word / WPS 导出即可。
 */

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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

    const doc = buildPlanDocument(plan);
    const buffer = await renderPlanDocx(doc);

    const fileName = documentFileName(plan);

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
