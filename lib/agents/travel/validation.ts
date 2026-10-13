/**
 * 旅行需求校验与归一化。
 *
 * 为什么单独一个模块：表单输入来自 HTTP 请求体，任何字段都不可信。
 * 这里一次性把所有字段收敛为可信的 TripQuery，并把「能自动修正的」
 * （如城市名边界、偏好标签数量）修正掉，把「不能自动修正的」
 * （如返程早于去程）汇总成可读错误，避免调用方到处写 if。
 */

import { diffInDays, isDateString, parseDateOnly, resolveDuration, today } from "./date";
import type { TravelStyle, TripQuery } from "./types";

/** 校验失败：携带面向用户的错误清单 */
export class TravelValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join("；"));
    this.name = "TravelValidationError";
    this.errors = errors;
  }
}

/** 允许的预算档位 */
const STYLES: TravelStyle[] = ["budget", "comfort", "premium", "luxury"];

/** 上限：单人单次行程最长天数，防止把模型上下文撑爆 */
export const MAX_TRIP_DAYS = 45;

/** 上限：同行总人数 */
export const MAX_PARTY_SIZE = 30;

/** 上限：偏好标签数量 */
const MAX_INTERESTS = 8;

/** 上限：自由文本长度 */
const MAX_NOTES_LENGTH = 500;

/** 归一化结果：可信输入 + 非阻断性提示 */
export interface NormalizedTripQuery {
  query: TripQuery;
  warnings: string[];
}

function readText(value: unknown, field: string, errors: string[], maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`请填写${field}`);
    return "";
  }

  const trimmed = value.trim().replace(/\s+/g, " ");

  if (trimmed.length > maxLength) {
    errors.push(`${field}过长（最多 ${maxLength} 字）`);
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
}

/** 解析非负整数，失败时记错并返回兜底值 */
function readInt(
  value: unknown,
  field: string,
  errors: string[],
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    errors.push(`${field}必须是数字`);
    return fallback;
  }

  const rounded = Math.round(parsed);

  if (rounded < min || rounded > max) {
    errors.push(`${field}需在 ${min} 到 ${max} 之间`);
    return fallback;
  }

  return rounded;
}

/** 归一化偏好标签：去空、去重、截断 */
function readInterests(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const trimmed = item.trim();

    if (trimmed.length === 0 || trimmed.length > 20 || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);

    if (result.length >= MAX_INTERESTS) {
      break;
    }
  }

  return result;
}

/**
 * 把不可信输入归一化为 TripQuery。
 * @throws TravelValidationError 当存在无法自动修正的问题时
 */
export function normalizeTripQuery(input: unknown): NormalizedTripQuery {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof input !== "object" || input === null) {
    throw new TravelValidationError(["请求体必须是 JSON 对象"]);
  }

  const raw = input as Record<string, unknown>;

  const origin = readText(raw.origin, "出发城市", errors, 40);
  const destination = readText(raw.destination, "目的地", errors, 40);

  if (origin && destination && origin === destination) {
    errors.push("出发城市与目的地不能相同");
  }

  // ---------- 日期 ----------
  const departDate = isDateString(raw.departDate) ? raw.departDate.trim() : "";
  const returnDate = isDateString(raw.returnDate) ? raw.returnDate.trim() : "";

  if (!departDate) {
    errors.push("请填写去程日期（格式 YYYY-MM-DD）");
  } else if (parseDateOnly(departDate) === null) {
    errors.push("去程日期不是有效日期");
  }

  if (!returnDate) {
    errors.push("请填写返程日期（格式 YYYY-MM-DD）");
  } else if (parseDateOnly(returnDate) === null) {
    errors.push("返程日期不是有效日期");
  }

  let days = 0;

  if (departDate && returnDate) {
    const span = diffInDays(departDate, returnDate);

    if (span !== null && span < 0) {
      errors.push("返程日期不能早于去程日期");
    } else {
      const duration = resolveDuration(departDate, returnDate);

      if (duration) {
        days = duration.days;

        if (days > MAX_TRIP_DAYS) {
          errors.push(`行程过长（最多 ${MAX_TRIP_DAYS} 天），当前为 ${days} 天`);
        }

        if (duration.nights === 0) {
          warnings.push("去返程为同一天，已按一日游规划，不含住宿");
        }
      }
    }

    const todayStr = today();
    const leadDays = diffInDays(todayStr, departDate);

    if (leadDays !== null && leadDays < 0) {
      warnings.push("去程日期早于今天，报价与天气仅供参考");
    }
  }

  // ---------- 人数 ----------
  const partyRaw =
    typeof raw.party === "object" && raw.party !== null
      ? (raw.party as Record<string, unknown>)
      : {};

  const adults = readInt(partyRaw.adults ?? raw.adults, "成人数", errors, 1, 1, MAX_PARTY_SIZE);
  const childrenMax = Math.max(0, MAX_PARTY_SIZE - adults);
  const children = readInt(
    partyRaw.children ?? raw.children ?? 0,
    "儿童数",
    errors,
    0,
    0,
    childrenMax,
  );

  if (adults + children > MAX_PARTY_SIZE) {
    errors.push(`同行人数最多 ${MAX_PARTY_SIZE} 人`);
  }

  if (children > 0) {
    warnings.push("儿童按 2-12 岁估算：机票约成人 75 折，多数景区免票或半价");
  }

  // ---------- 预算 ----------
  const budget = readInt(raw.budget, "预算", errors, 0, 100, 10_000_000);

  const style = STYLES.includes(raw.style as TravelStyle)
    ? (raw.style as TravelStyle)
    : "comfort";

  if (raw.style !== undefined && !STYLES.includes(raw.style as TravelStyle)) {
    warnings.push("未识别的预算档位，已按「舒适型」规划");
  }

  const interests = readInterests(raw.interests);

  const notes =
    typeof raw.notes === "string" && raw.notes.trim().length > 0
      ? raw.notes.trim().slice(0, MAX_NOTES_LENGTH)
      : undefined;

  // 人均每日预算过低时提前示警，避免生成明显不可行的方案
  if (budget > 0 && days > 0 && adults + children > 0) {
    const perPersonPerDay = budget / (adults + children) / days;

    if (perPersonPerDay < 150) {
      warnings.push(
        `人均每日约 ${Math.round(perPersonPerDay)} 元，低于多数目的地的可行下限，预算项会给出差距提示`,
      );
    }
  }

  if (errors.length > 0) {
    throw new TravelValidationError(errors);
  }

  return {
    query: {
      origin,
      destination,
      departDate,
      returnDate,
      party: { adults, children },
      budget,
      style,
      interests,
      notes,
    },
    warnings,
  };
}
