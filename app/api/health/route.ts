import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let database = "connected";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  return NextResponse.json({
    status: "ok",
    app: "ai-insight-daily",
    database,
    time: new Date().toISOString(),
  });
}
