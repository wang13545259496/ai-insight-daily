/**
 * 旅行方案的数据访问层。
 *
 * 与项目其它模块保持一致：Prisma 调用集中在此处，接口层不直接碰 DB。
 * 方案的正文以 JSON 字符串存放（见 schema.prisma 的 TripPlan 注释），
 * 读取时才解析，解析失败不能让整个列表页崩掉，因此做了逐条兜底。
 */

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

import type { TravelPlan, TripQuery } from "./types";

/** 报价来源标记，用于列表页快速标注「是否真实报价」 */
export type QuoteMode = "live" | "partial" | "estimate";

/** 保存方案所需的行数据 */
export interface SavePlanInput {
  plan: TravelPlan;
  quoteMode: QuoteMode;
}

/**
 * 计算需求指纹。
 *
 * 只纳入「影响方案内容」的字段：出发地、目的地、日期、人数、预算、
 * 档位、偏好、补充要求；生成时间等无关字段不参与，保证同一需求
 * 每次得到相同指纹。
 *
 * 为什么需要它：一次生成要调用一次大模型并发出数十次高德请求，
 * 用户连点两次或刷新重试会造成重复消耗。指纹让重复提交直接命中已有方案。
 */
export function computeFingerprint(query: TripQuery): string {
  const normalized = JSON.stringify({
    o: query.origin.trim().toLowerCase(),
    d: query.destination.trim().toLowerCase(),
    dd: query.departDate,
    rd: query.returnDate,
    a: query.party.adults,
    c: query.party.children,
    b: query.budget,
    s: query.style,
    i: [...query.interests].sort(),
    n: (query.notes ?? "").trim(),
  });

  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

/**
 * 查找与本次需求完全相同的已有方案。
 * 命中时调用方可直接复用，不必再调模型与地图接口。
 */
export async function findPlanByFingerprint(
  fingerprint: string,
): Promise<{ id: number; plan: TravelPlan } | null> {
  const record = await prisma.tripPlan.findUnique({
    where: { fingerprint },
    select: { id: true, planJson: true },
  });

  if (!record) {
    return null;
  }

  try {
    return { id: record.id, plan: JSON.parse(record.planJson) as TravelPlan };
  } catch (error) {
    // 存量 JSON 损坏时不要让去重把功能卡死，退回重新生成
    console.error("[travel] 去重命中但 JSON 解析失败", {
      id: record.id,
      error: String(error),
    });

    return null;
  }
}

/**
 * 删除指定历史方案。
 * 重新生成时用它清理旧记录，避免与唯一索引冲突。
 */
export async function deletePlanById(id: number): Promise<void> {
  await prisma.tripPlan.deleteMany({ where: { id } });
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
      fingerprint: computeFingerprint(query),
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
