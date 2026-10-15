/**
 * 取逐日路线图的图片数据，供嵌入文档。
 *
 * 为什么需要它：静态图 URL 里含有高德 Key，直接把 URL 写进文档既不安全
 * （文档会被转发，Key 随之泄露）也不可靠（阅读端未必能联网取图）。
 * 因此导出时由服务端取回 PNG 再嵌入。
 *
 * 失败处理：单天取不到就跳过该天，不影响整份文档 ——
 * 地图是加分项，行程文字才是主体。
 */

import type { TravelPlan } from "./types";
import { buildDayMapUrlSafe } from "./staticmap";
import type { DayMapImage } from "./exportDocx";

/** 单张图片的取回超时（毫秒） */
const FETCH_TIMEOUT_MS = 15_000;

/**
 * 两次请求之间的间隔（毫秒）。
 *
 * 为什么必须串行且加间隔：高德静态图接口有 QPS 限制，
 * 实测并发请求会返回 CUQPS_HAS_EXCEEDED_THE_LIMIT（10021），
 * 且返回体是 JSON 而非图片。曾因此让 5 天的行程只嵌进去 1 张图。
 * 串行 + 350ms 间隔可稳定通过，5 天约 2 秒，下载场景可以接受。
 */
const REQUEST_GAP_MS = 350;

/** 单张图的重试次数（针对限流这类瞬时失败） */
const RETRY_TIMES = 2;

/** 重试前的等待（毫秒），比常规间隔更长以避开限流窗口 */
const RETRY_DELAY_MS = 900;

/** 等待指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 取一张图；成功返回 PNG 数据，失败返回 null */
async function fetchOneMap(url: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= RETRY_TIMES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });

      if (res.ok) {
        const type = res.headers.get("content-type") || "";

        // 接口出错时会返回 JSON 而非图片，按失败处理（可能触发重试）
        if (type.includes("image")) {
          const data = Buffer.from(await res.arrayBuffer());

          if (data.length >= 1000) return data;
        }
      }
    } catch {
      // 超时或网络错误，走重试
    } finally {
      clearTimeout(timer);
    }

    if (attempt < RETRY_TIMES) await sleep(RETRY_DELAY_MS);
  }

  return null;
}

/**
 * 为方案中指定的若干天取回路线图。
 *
 * 串行取回（见 REQUEST_GAP_MS 的说明），单天失败不影响其它天。
 *
 * @param plan 行程方案
 * @param days 需要取图的天数；为空则取全部有坐标的天
 * @param limit 最多取几张（防止文档过大）
 */
export async function fetchDayMapImages(
  plan: TravelPlan,
  days?: number[],
  limit = 7,
): Promise<{ images: DayMapImage[]; failed: number[] }> {
  const targets = (days && days.length > 0 ? days : plan.itinerary.map((d) => d.day)).slice(
    0,
    limit,
  );

  const images: DayMapImage[] = [];
  const failed: number[] = [];

  for (const [index, dayNumber] of targets.entries()) {
    const day = plan.itinerary.find((d) => d.day === dayNumber);

    if (!day) continue;

    const points = day.activities
      .filter((a) => typeof a.coordinates === "string" && a.coordinates.length > 0)
      .map((a, index2) => ({ location: a.coordinates as string, index: index2 + 1 }));

    const url = buildDayMapUrlSafe(points, plan.dayRoutePolylines?.[dayNumber] ?? null);

    // 坐标不足两个时不画图（一个点无法表达路线），也不算失败
    if (!url) continue;

    // 首张不用等，其余按间隔串行
    if (index > 0) await sleep(REQUEST_GAP_MS);

    const data = await fetchOneMap(url);

    if (data) images.push({ day: dayNumber, data });
    else failed.push(dayNumber);
  }

  return { images, failed };
}
