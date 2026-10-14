import { NextResponse } from "next/server";

import { fetchRSSNewsDetailed } from "@/lib/rss";
import { ingestNewsItems } from "@/lib/news/ingest";

export const dynamic = "force-dynamic";

/**
 * 手动导入新闻。
 *
 * 两处修正：
 *   1. 补鉴权。此前该接口无任何保护，任何人访问即可触发写库。
 *      现与 /api/cron/* 一致，使用 CRON_SECRET Bearer 校验。
 *   2. 复用统一入库模块。此前内联了一套只比标题精确值、
 *      且不写 duplicateHash 的逻辑，是重复数据的来源之一。
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const fetched = await fetchRSSNewsDetailed();
    const result = await ingestNewsItems(fetched.items);

    return NextResponse.json({
      success: true,
      sources: fetched.sources.length,
      total: result.fetched,
      imported: result.created,
      duplicated: result.duplicated,
      merged: result.merged,
      emptyContent: result.emptyContent,
      errors: result.errors.slice(0, 10),
    });
  } catch (error) {
    console.error("[news/import] 导入失败", { error: String(error) });

    return NextResponse.json(
      { success: false, message: "导入失败", error: String(error) },
      { status: 500 },
    );
  }
}
