import { NextResponse } from "next/server";

import { importNews } from "@/lib/news-import";

export const dynamic = "force-dynamic";

/**
 * 手动导入新闻（带板块分类）。
 *
 * 与 /api/news/import 一样补上鉴权：此前无任何保护。
 * 入库逻辑复用 lib/news-import.ts，其中已下沉到统一入库模块。
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await importNews();

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[import-news] 导入失败", { error: String(error) });

    return NextResponse.json(
      { success: false, message: "导入失败", error: String(error) },
      { status: 500 },
    );
  }
}
