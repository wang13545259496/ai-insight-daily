/**
 * 旅行日期工具。
 *
 * 全部按「本地日历日」处理，避免用 Date 的时区换算导致天数差一天：
 * 先把 YYYY-MM-DD 解析为 UTC 零点，再做毫秒差，最后按天取整。
 */

import type { TripDuration } from "./types";

/** 一天的毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 是否形如 YYYY-MM-DD。
 * 注意只校验格式，不校验是否为真实存在的日期（如 2026-02-30）。
 */
export function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/**
 * 把 YYYY-MM-DD 转为 UTC 零点的毫秒时间戳。
 * 非法输入返回 null，由调用方决定如何报错。
 */
export function parseDateOnly(value: string): number | null {
  if (!isDateString(value)) {
    return null;
  }

  const [year, month, day] = value.trim().split("-").map(Number);

  const timestamp = Date.UTC(year, month - 1, day);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  // 反向校验，拦住 2026-02-30 这类「格式对但日期不存在」的输入
  const back = new Date(timestamp);

  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

/** 把毫秒时间戳格式化为 YYYY-MM-DD */
export function formatDateOnly(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** 在 YYYY-MM-DD 上加减天数，返回 YYYY-MM-DD；非法输入返回 null */
export function addDays(value: string, days: number): string | null {
  const base = parseDateOnly(value);

  if (base === null) {
    return null;
  }

  return formatDateOnly(base + days * DAY_MS);
}

/** 两个日期之间的整天数（to - from） */
export function diffInDays(from: string, to: string): number | null {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);

  if (start === null || end === null) {
    return null;
  }

  return Math.round((end - start) / DAY_MS);
}

/** 今天（本地日历日）的 YYYY-MM-DD */
export function today(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * 由去返程日期推导行程天数结构。
 * 返程日当天也算一天行程，因此 days = nights + 1。
 */
export function resolveDuration(departDate: string, returnDate: string): TripDuration | null {
  const nights = diffInDays(departDate, returnDate);

  if (nights === null || nights < 0) {
    return null;
  }

  return { nights, days: nights + 1 };
}

/** 生成从 departDate 起连续 days 天的日期数组 */
export function buildDateRange(departDate: string, days: number): string[] {
  const dates: string[] = [];

  for (let offset = 0; offset < days; offset++) {
    const date = addDays(departDate, offset);

    if (date === null) {
      break;
    }

    dates.push(date);
  }

  return dates;
}

/** 把 1-7 映射为「周一」这类中文星期 */
export function weekdayLabel(date: string): string {
  const timestamp = parseDateOnly(date);

  if (timestamp === null) {
    return "";
  }

  const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  return names[new Date(timestamp).getUTCDay()];
}

/** 判断日期是否落在「节假日高价窗口」（春节/国庆/暑假），用于报价与提示 */
export function isPeakSeason(date: string): boolean {
  const timestamp = parseDateOnly(date);

  if (timestamp === null) {
    return false;
  }

  const d = new Date(timestamp);
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();

  // 暑假 7-8 月
  if (month === 7 || month === 8) {
    return true;
  }

  // 国庆黄金周 10-01 ~ 10-07
  if (month === 10 && day <= 7) {
    return true;
  }

  // 春节窗口（粗略覆盖 1 月下旬至 2 月中旬）
  if (month === 1 && day >= 20) {
    return true;
  }

  if (month === 2 && day <= 20) {
    return true;
  }

  return false;
}
