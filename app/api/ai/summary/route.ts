import { NextResponse } from "next/server";
import { generateSummary } from "@/lib/ai-summary";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title = String(body?.title || "").trim();
    const content = String(body?.content || "").trim();

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少新闻标题",
        },
        {
          status: 400,
        }
      );
    }

    const result = await generateSummary(
      title,
      content
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "AI摘要生成失败:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      {
        status: 500,
      }
    );
  }
}
