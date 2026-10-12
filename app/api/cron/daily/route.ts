import { NextResponse } from "next/server";
import { runNewsPipeline } from "@/lib/scheduler/newsPipeline";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader =
    request.headers.get("authorization");

  if (
    process.env.CRON_SECRET &&
    authHeader !==
      `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const result = await runNewsPipeline();

    return NextResponse.json({
      success: true,
      message: "AI日报自动流水线执行完成",
      data: result,
    });
  } catch (error) {
    console.error(
      "日报流水线执行失败:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "日报流水线执行失败",
        error: String(error),
      },
      {
        status: 500,
      }
    );
  }
}
