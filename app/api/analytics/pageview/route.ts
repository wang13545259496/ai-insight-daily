import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (/tablet|ipad|android(?!.*mobile)/i.test(ua)) {
    return "tablet";
  }

  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) {
    return "mobile";
  }

  return "desktop";
}

function normalizePath(path: string): string | null {
  if (!path || !path.startsWith("/")) {
    return null;
  }

  if (
    path.startsWith("/api") ||
    path.startsWith("/admin") ||
    path.startsWith("/_next")
  ) {
    return null;
  }

  return path.slice(0, 500);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const path = normalizePath(
      typeof body?.path === "string" ? body.path : ""
    );

    if (!path) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid path",
        },
        { status: 400 }
      );
    }

    const referrer =
      typeof body?.referrer === "string"
        ? body.referrer.slice(0, 1000)
        : null;

    const userAgent = request.headers.get("user-agent") ?? "";

    const device = detectDevice(userAgent);

    await prisma.pageView.create({
      data: {
        path,
        referrer,
        device,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("PageView API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to record page view",
      },
      { status: 500 }
    );
  }
}
