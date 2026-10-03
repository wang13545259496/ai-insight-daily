import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const trends = await prisma.industryTrend.findMany({
    include: {
      hotspot: true,
    },

    orderBy: {
      date: "asc",
    },
  });

  return NextResponse.json(trends);
}
