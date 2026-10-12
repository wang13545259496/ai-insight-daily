import { NextResponse } from "next/server";
import { runNewsPipeline } from "@/lib/scheduler/newsPipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runNewsPipeline();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "测试流水线失败:",
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
