/**
 * 取逐日路线图的图片数据，供嵌入文档。
 *
 * 为什么需要它：图片 URL 里含有高德 Key，直接把 URL 写进文档既不安全
 * （文档会被转发，Key 随之泄露）也不可靠（阅读端未必能联网取图）。
 * 因此导出时由服务端生成 PNG 再嵌入。
 *
 * 图片内容与网页上完全一致（同一个渲染函数）：带编号圆点、真实道路连线。
 * 曾经这里取的是高德原始静态图，结果文档里的编号小到看不清，与网页对不上。
 *
 * 失败处理：单天取不到就跳过该天，不影响整份文档 ——
 * 地图是加分项，行程文字才是主体。
 */

import { renderPlanDayMapPng } from "./daymap";
import type { ItineraryDay, TravelPlan } from "./types";
import type { DayMapImage } from "./exportDocx";

/**
 * 两次取图之间的间隔（毫秒）。
 *
 * 为什么必须串行且加间隔：高德静态图接口有 QPS 限制，
 * 实测并发请求会返回 CUQPS_HAS_EXCEEDED_THE_LIMIT（10021），
 * 且返回体是 JSON 而非图片。曾因此让 5 天的行程只嵌进去 1 张图。
 * 串行 + 350ms 间隔可稳定通过，5 天约 2 秒，下载场景可以接受。
 */
const REQUEST_GAP_MS = 350;

/** 渲染器签名：给一天出图，失败返回 null */
export type DayMapRenderer = (plan: TravelPlan, day: ItineraryDay) => Promise<Buffer | null>;

/** 等待指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 为方案中指定的若干天取回路线图。
 *
 * 串行取回（见 REQUEST_GAP_MS 的说明），单天失败不影响其它天。
 *
 * @param plan 行程方案
 * @param days 需要取图的天数；为空则取全部有坐标的天
 * @param limit 最多取几张（防止文档过大）
 * @param render 渲染器，默认用真实的高德底图合成；测试时注入假实现
 */
export async function fetchDayMapImages(
  plan: TravelPlan,
  days?: number[],
  limit = 7,
  render: DayMapRenderer = renderPlanDayMapPng,
): Promise<{ images: DayMapImage[]; failed: number[] }> {
  // 先筛掉没有任何坐标的天：渲染器同样会返回 null，但排队等待是白花的
  const candidates = (days && days.length > 0 ? days : plan.itinerary.map((d) => d.day)).filter(
    (dayNumber) => {
      const day = plan.itinerary.find((item) => item.day === dayNumber);

      return Boolean(day?.activities.some((activity) => activity.coordinates));
    },
  );

  const targets = candidates.slice(0, limit);

  const images: DayMapImage[] = [];
  const failed: number[] = [];

  for (const [index, dayNumber] of targets.entries()) {
    const day = plan.itinerary.find((d) => d.day === dayNumber);

    if (!day) continue;

    // 首张不用等，其余按间隔串行
    if (index > 0) await sleep(REQUEST_GAP_MS);

    const data = await render(plan, day);

    if (!data) {
      // 走到这里的都是「有坐标」的天，出不来图就是失败
      failed.push(dayNumber);
      continue;
    }

    images.push({ day: dayNumber, data });
  }

  return { images, failed };
}
