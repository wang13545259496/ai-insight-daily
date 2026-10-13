/**
 * 旅行方案的数据访问层。
 *
 * 与项目其它模块保持一致：Prisma 调用集中在此处，接口层不直接碰 DB。
 * 方案的正文以 JSON 字符串存放（见 schema.prisma 的 TripPlan 注释），
 * 读取时才解析，解析失败不能让整个列表页崩掉，因此做了逐条兜底。
 */

import { prisma } from "@/lib/prisma";

import type { TravelPlan } from "./types";

/** 报价来源标记，用于列表页快速标注「是否真实报价」 */
export type QuoteMode = "live" | "partial" | "estimate";

/** 保存方案所需的行数据 */
export interface SavePlanInput {
  plan: TravelPlan;
  quoteMode: QuoteMode;
}

/** 判定报价来源：区分「全部真实」「部分真实」「全为估算」 */
export function resolveQuoteMode(plan: TravelPlan): QuoteMode {
  const flightLive = plan.quotes.flight?.confidence === "live";
  const hotelLive = plan.quotes.hotel?.confidence === "live";

  const liveCount = (flightLive ? 1 : 0) + (hotelLive ? 1 : 0);
  const totalCount = (plan.quotes.flight ? 1 : 0) + (plan.quotes.hotel ? 1 : 0);

  if (liveCount === 0) {
    return "estimate";
  }

  return liveCount === totalCount ? "live" : "partial";
}

/** 落库并返回记录 id */
export async function savePlan(input: SavePlanInput): Promise<number> {
  const { plan, quoteMode } = input;
  const { query, duration } = plan;

  const record = await prisma.tripPlan.create({
    data: {
      origin: query.origin,
      destination: query.destination,
      departDate: query.departDate,
      returnDate: query.returnDate,
      adults: query.party.adults,
      children: query.party.children,
      budget: query.budget,
      style: query.style,
      interests: query.interests.length > 0 ? query.interests.join(",") : null,
      planJson: JSON.stringify(plan),
      overview: plan.overview.slice(0, 1000),
      quoteMode,
      generatedByAI: plan.generatedByAI,
      model: plan.model ?? null,
    },
    select: { id: true },
  });

  // duration 只用于日志，便于排查「存了但天数不对」的问题
  console.info("[travel] 方案已保存", {
    id: record.id,
    destination: query.destination,
    days: duration.days,
    quoteMode,
  });

  return record.id;
}

/** 列表项：不含完整 JSON，避免列表页传输过大 */
export interface TripPlanListItem {
  id: number;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  children: number;
  budget: number;
  style: string;
  overview: string;
  quoteMode: string;
  generatedByAI: boolean;
  createdAt: string;
  days: number;
}

/** 读取单条方案的完整内容，解析失败返回 null */
export async function getPlanById(id: number): Promise<TravelPlan | null> {
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const record = await prisma.tripPlan.findUnique({ where: { id } });

  if (!record) {
    return null;
  }

  try {
    return JSON.parse(record.planJson) as TravelPlan;
  } catch (error) {
    console.error("[travel] 方案 JSON 解析失败", { id, error: String(error) });

    return null;
  }
}

/** 读取列表，按创建时间倒序 */
export async function listPlans(limit = 20): Promise<TripPlanListItem[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);

  const records = await prisma.tripPlan.findMany({
    orderBy: { createdAt: "desc" },
    take: safeLimit,
    select: {
      id: true,
      origin: true,
      destination: true,
      departDate: true,
      returnDate: true,
      adults: true,
      children: true,
      budget: true,
      style: true,
      overview: true,
      quoteMode: true,
      generatedByAI: true,
      createdAt: true,
    },
  });

  return records.map((record) => ({
    id: record.id,
    origin: record.origin,
    destination: record.destination,
    departDate: record.departDate,
    returnDate: record.returnDate,
    adults: record.adults,
    children: record.children,
    budget: record.budget,
    style: record.style,
    overview: record.overview,
    quoteMode: record.quoteMode,
    generatedByAI: record.generatedByAI,
    createdAt: record.createdAt.toISOString(),
    // 天数由日期差推导，避免再存一列冗余数据
    days: diffDays(record.departDate, record.returnDate) + 1,
  }));
}

/** 两个 YYYY-MM-DD 之间的整天数；解析失败按 0 处理 */
function diffDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }

  return Math.max(0, Math.round((end - start) / 86_400_000));
}
