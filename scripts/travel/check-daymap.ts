/**
 * 检查逐日路线图的取景与折线是否健康。
 *
 * 为什么需要这个脚本：地图出问题时，症状只是「图看起来不对」——
 * 可能是 zoom 与当天跨度不匹配、折线中间丢段、或坐标被过滤掉了，
 * 三种原因在页面上长得差不多。这里把每天的判断依据打印出来。
 *
 * 用法：
 *   npx tsx scripts/travel/check-daymap.ts        # 检查最近 3 条方案
 *   npx tsx scripts/travel/check-daymap.ts 49     # 指定方案
 *   npx tsx scripts/travel/check-daymap.ts 49 2   # 只看第 2 天
 *
 * 关注三点：
 *   zoom      与当天跨度是否匹配（跨几十公里的天不该是 13 级）
 *   非法点    应为 0；非 0 说明折线格式变了，点会被静默丢弃 → 线断
 *   最大跳跃  超过画布尺寸说明折线中间丢了整段
 */

import { PrismaClient } from "@prisma/client";

import {
  DAY_MAP_HEIGHT,
  DAY_MAP_WIDTH,
  buildDayMapModel,
  fitDayView,
  parseLocation,
  projectToPixel,
} from "../../lib/agents/travel/daymap-core";
import type { TravelPlan } from "../../lib/agents/travel/types";

const prisma = new PrismaClient();

/** 读了方案就把连接关掉，避免脚本挂住事件循环 */
async function loadPlans(planId?: number): Promise<Array<{ id: number; plan: TravelPlan }>> {
  const rows = await prisma.tripPlan.findMany({
    where: planId ? { id: planId } : undefined,
    orderBy: { id: "desc" },
    take: planId ? 1 : 3,
    select: { id: true, planJson: true },
  });

  const plans: Array<{ id: number; plan: TravelPlan }> = [];

  for (const row of rows) {
    try {
      plans.push({ id: row.id, plan: JSON.parse(row.planJson) as TravelPlan });
    } catch (error) {
      console.error(`方案 ${row.id} 的 JSON 解析失败：${String(error)}`);
    }
  }

  return plans;
}

async function main(): Promise<void> {
  const planArg = process.argv[2] ? Number(process.argv[2]) : undefined;
  const dayArg = process.argv[3] ? Number(process.argv[3]) : undefined;
  const plans = await loadPlans(planArg);

  if (plans.length === 0) {
    console.log("没有可检查的方案");
    return;
  }

  for (const { id, plan } of plans) {
    console.log(`\n=== 方案 #${id} ${plan.query.origin} → ${plan.query.destination} ===`);

    for (const day of plan.itinerary) {
      if (dayArg !== undefined && day.day !== dayArg) continue;

      const { stops } = buildDayMapModel(day);
      const polyline = plan.dayRoutePolylines?.[day.day] ?? null;
      const chunks = polyline ? polyline.split(";") : [];
      const points = chunks.map((chunk) => parseLocation(chunk.trim()));
      const valid = points.filter((point): point is [number, number] => point !== null);
      const invalid = points.length - valid.length;

      const view = fitDayView(
        [...stops.map((stop) => parseLocation(stop.location) as [number, number]), ...valid],
        DAY_MAP_WIDTH,
        DAY_MAP_HEIGHT,
      );

      // 投影后算最大跳跃：连续两点若跳得很远，说明折线中间丢了段
      let maxJump = 0;

      if (view) {
        const pixels = valid.map(([lng, lat]) => projectToPixel(lng, lat, view, DAY_MAP_WIDTH, DAY_MAP_HEIGHT));

        for (let i = 1; i < pixels.length; i++) {
          const distance = Math.hypot(
            pixels[i][0] - pixels[i - 1][0],
            pixels[i][1] - pixels[i - 1][1],
          );

          if (distance > maxJump) maxJump = distance;
        }
      }

      const outside = view
        ? stops.filter((stop) => {
            const point = parseLocation(stop.location);

            if (!point) return true;

            const [x, y] = projectToPixel(point[0], point[1], view, DAY_MAP_WIDTH, DAY_MAP_HEIGHT);

            return x < 0 || x > DAY_MAP_WIDTH || y < 0 || y > DAY_MAP_HEIGHT;
          }).length
        : stops.length;

      const flags: string[] = [];

      if (stops.length === 0) flags.push("无坐标→不出图");
      if (outside > 0) flags.push(`${outside} 个标注越界`);
      if (invalid > 0) flags.push(`${invalid} 个非法折线点`);
      if (maxJump > Math.max(DAY_MAP_WIDTH, DAY_MAP_HEIGHT) / 2) flags.push("折线可能丢段");

      console.log(
        `Day ${day.day} ${day.theme.slice(0, 12)}：标注 ${stops.length} 个，` +
          `折线 ${valid.length} 点，zoom ${view?.zoom ?? "-"}，` +
          `最大跳跃 ${maxJump.toFixed(0)}px` +
          (flags.length > 0 ? `  ⚠ ${flags.join(" / ")}` : "  ✓"),
      );
    }
  }
}

main()
  .catch((error) => {
    console.error("检查失败", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
