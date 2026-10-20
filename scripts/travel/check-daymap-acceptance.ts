/**
 * 逐日行程地图验收清单（自动部分）。
 *
 * 为什么要有这个脚本：地图出问题的表现都很像 —— 「图看着不对」，
 * 但原因可能是没坐标、编号跳号、标注越界、折线断段、服务器没字体……
 * 靠肉眼看一天两天能发现，靠记忆不行。这里把「什么叫合格」写成可执行的判断，
 * 每次改动跑一遍：通过多少条、哪几条没过，一目了然。
 *
 * 用法（在项目根目录）：
 *   npx tsx scripts/travel/check-daymap-acceptance.ts            # 最近 3 条方案
 *   npx tsx scripts/travel/check-daymap-acceptance.ts --plan 56  # 指定方案
 *   npx tsx scripts/travel/check-daymap-acceptance.ts --plans 10 # 最近 10 条
 *   npx tsx scripts/travel/check-daymap-acceptance.ts --verbose  # 逐条打印
 *
 * 退出码：有「必须修」的项未通过时为 1，否则 0（方便接进部署脚本）。
 * 清单说明见 ai-context/TRAVEL_MAP_ACCEPTANCE.md。
 */

import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  DAY_MAP_HEIGHT,
  DAY_MAP_WIDTH,
  buildDayMapModel,
  fitDayView,
  parseLocation,
  projectToPixel,
} from "../../lib/agents/travel/daymap-core";
import type { DayMapStop } from "../../lib/agents/travel/daymap-core";
import type { ItineraryDay, TravelPlan } from "../../lib/agents/travel/types";

/** 中国境内大致范围：高德底图只覆盖中国，境外坐标会出空白图 */
const CHINA_BBOX = { minLng: 73, maxLng: 136, minLat: 3, maxLat: 54 };

/** 折线相邻投影点的最大允许跳跃（占画布对角线的比例） */
const MAX_JUMP_RATIO = 0.25;

/** 折线首尾与首末编号的最大允许偏差（像素） */
const MAX_END_OFFSET_PX = 80;

/** 取景留边比例，与 renderer 的 VIEW_MARGIN 保持一致 */
const VIEW_MARGIN = 0.12;

/** 单条检查结果 */
type Status = "pass" | "warn" | "fail";

interface CheckResult {
  /** 清单编号，如 A1 / D3 */
  id: string;
  /** 一句话结论 */
  title: string;
  status: Status;
  /** 出问题时的说明（人话） */
  detail?: string;
}

/** 一条方案的结果 */
interface PlanReport {
  id: number;
  destination: string;
  days: Array<{ day: number; results: CheckResult[] }>;
  global: CheckResult[];
}

/** 手动加载 .env.local（next 之外运行，没人替我们注入环境变量） */
function loadEnvFile(): void {
  const file = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

/**
 * 服务器有没有可用字体。
 *
 * 为什么单独查这一条：编号是 sharp 用 SVG <text> 画的，服务器没有任何字体时
 * 文字会被静默丢弃 —— 接口照样 200，图上却只剩红点。2026-10-20 上线时踩过。
 */
async function fontsAvailable(): Promise<{ ok: boolean; detail: string }> {
  let sharp: typeof import("sharp").default;

  try {
    const mod = await import("sharp");
    sharp = mod.default;
  } catch {
    return { ok: false, detail: "sharp 不可用，地图无法合成（Next 的可选依赖未安装）" };
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
    <rect width="40" height="40" fill="#000000"/>
    <text x="20" y="29" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif"
          font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">8</text>
  </svg>`;

  try {
    const { data, info } = await sharp(Buffer.from(svg))
      .raw()
      .toBuffer({ resolveWithObject: true });

    let bright = 0;

    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i] > 200) bright += 1;
    }

    if (bright === 0) {
      return {
        ok: false,
        detail: "系统没有可用字体，编号会渲染成空白（只剩红点）。安装：sudo apt-get install -y fontconfig fonts-dejavu-core",
      };
    }

    return { ok: true, detail: `字体可用（亮点 ${bright} 个像素）` };
  } catch (error) {
    return { ok: false, detail: `字体探测失败：${String(error)}` };
  }
}

/** 一天里所有有坐标的活动 */
function locatedActivities(day: ItineraryDay): Array<{ coordinates: string; index: number }> {
  const out: Array<{ coordinates: string; index: number }> = [];

  for (const [index, activity] of day.activities.entries()) {
    if (typeof activity.coordinates === "string" && activity.coordinates.length > 0) {
      out.push({ coordinates: activity.coordinates, index });
    }
  }

  return out;
}

/** 检查一天 */
function checkDay(
  day: ItineraryDay,
  plan: TravelPlan,
  drawable: boolean,
): CheckResult[] {
  const results: CheckResult[] = [];
  const located = locatedActivities(day);
  const model = buildDayMapModel(day);
  const polyline = plan.dayRoutePolylines?.[day.day] ?? null;

  // ---------- A 内容齐全 ----------
  results.push(
    located.length > 0
      ? { id: "A1", title: "当天有坐标", status: "pass" }
      : {
          id: "A1",
          title: "当天有坐标",
          status: "warn",
          detail: "当天没有一个活动带坐标，这张图不会生成（图注也不显示）",
        },
  );

  const parsed = located.map((item) => parseLocation(item.coordinates));
  const invalid = parsed.filter((item) => item === null).length;

  results.push(
    invalid === 0
      ? { id: "A2", title: "坐标格式合法", status: "pass" }
      : {
          id: "A2",
          title: "坐标格式合法",
          status: "fail",
          detail: `${invalid} 个坐标格式不对，会被丢弃（该地点在图上消失）`,
        },
  );

  if (!drawable) return results;

  const outside = parsed.filter(
    (point) =>
      point !== null &&
      (point[0] < CHINA_BBOX.minLng ||
        point[0] > CHINA_BBOX.maxLng ||
        point[1] < CHINA_BBOX.minLat ||
        point[1] > CHINA_BBOX.maxLat),
  ).length;

  results.push(
    outside === 0
      ? { id: "A3", title: "坐标在境内", status: "pass" }
      : {
          id: "A3",
          title: "坐标在境内",
          status: "fail",
          detail: `${outside} 个坐标在中国境外，高德底图无覆盖，会出空白图`,
        },
  );

  // 同一坐标应合并成一个编号：合并后数量 = 去重后数量
  const uniqueKeys = new Set(
    parsed
      .filter((point): point is [number, number] => point !== null)
      .map((point) => `${point[0].toFixed(5)},${point[1].toFixed(5)}`),
  );

  results.push(
    model.stops.length === uniqueKeys.size
      ? { id: "A4", title: "同地点已合并", status: "pass" }
      : {
          id: "A4",
          title: "同地点已合并",
          status: "fail",
          detail: `标注点 ${model.stops.length} 个，去重后应为 ${uniqueKeys.size} 个`,
        },
  );

  // ---------- B 编号 ----------
  const numbers = model.stops.map((stop) => stop.number);
  const contiguous = numbers.every((value, index) => value === index + 1);

  results.push(
    contiguous
      ? { id: "B1", title: "编号连续", status: "pass" }
      : {
          id: "B1",
          title: "编号连续",
          status: "fail",
          detail: `编号为 ${numbers.join(",")}，应从 1 连续递增`,
        },
  );

  // 编号数量应与「带坐标的活动」对应（同坐标共享编号）
  const activityNumbered = model.activityNumbers.filter((value) => value !== null).length;

  results.push(
    activityNumbered === located.length
      ? { id: "B2", title: "每个地点都有编号", status: "pass" }
      : {
          id: "B2",
          title: "每个地点都有编号",
          status: "fail",
          detail: `有坐标的活动 ${located.length} 个，实际编号 ${activityNumbered} 个`,
        },
  );

  // 编号顺序 = 活动先后顺序
  const ordered = model.activityNumbers
    .filter((value): value is number => value !== null)
    .every((value, index, array) => index === 0 || value >= array[index - 1]);

  results.push(
    ordered
      ? { id: "B3", title: "编号与活动顺序一致", status: "pass" }
      : {
          id: "B3",
          title: "编号与活动顺序一致",
          status: "fail",
          detail: "编号没有随活动顺序递增，图上数字会对不上列表",
        },
  );

  // ---------- C 取景 ----------
  const coordinates = model.stops
    .map((stop: DayMapStop) => parseLocation(stop.location))
    .filter((point): point is [number, number] => point !== null);

  const view = fitDayView(coordinates, DAY_MAP_WIDTH, DAY_MAP_HEIGHT);

  if (!view) {
    results.push({
      id: "C1",
      title: "标注都在画面内",
      status: "fail",
      detail: "取景计算失败（没有有效坐标）",
    });
    return results;
  }

  const marginX = DAY_MAP_WIDTH * VIEW_MARGIN;
  const marginY = DAY_MAP_HEIGHT * VIEW_MARGIN;

  const outOfFrame = coordinates.filter((point) => {
    const [x, y] = projectToPixel(point[0], point[1], view, DAY_MAP_WIDTH, DAY_MAP_HEIGHT);

    return (
      x < marginX || x > DAY_MAP_WIDTH - marginX || y < marginY || y > DAY_MAP_HEIGHT - marginY
    );
  }).length;

  results.push(
    outOfFrame === 0
      ? { id: "C1", title: "标注都在画面内", status: "pass" }
      : {
          id: "C1",
          title: "标注都在画面内",
          status: "fail",
          detail: `${outOfFrame} 个标注超出留边范围（图上看不到或贴边）`,
        },
  );

  // 跨度与缩放级别匹配：跨度大时级别必须降下来
  const lngSpan = Math.max(...coordinates.map((p) => p[0])) - Math.min(...coordinates.map((p) => p[0]));
  const latSpan = Math.max(...coordinates.map((p) => p[1])) - Math.min(...coordinates.map((p) => p[1]));
  // 粗算地面跨度（km）：1 度纬度约 111km
  const spanKm = Math.max(lngSpan * 111 * Math.cos((coordinates[0][1] * Math.PI) / 180), latSpan * 111);

  const zoomTooHigh = spanKm >= 20 && view.zoom > 12;
  const zoomTooLow = spanKm < 2 && view.zoom < 14;

  results.push(
    !zoomTooHigh && !zoomTooLow
      ? { id: "C2", title: "缩放匹配跨度", status: "pass" }
      : {
          id: "C2",
          title: "缩放匹配跨度",
          status: "fail",
          detail: `跨度约 ${spanKm.toFixed(1)}km，却用了 ${view.zoom} 级（大跨度应 ≤12，小范围应 ≥14）`,
        },
  );

  // 单点/同地点的一天不能贴到屋顶
  const singlePlace = uniqueKeys.size === 1;

  results.push(
    !singlePlace || view.zoom <= 15
      ? { id: "C3", title: "单点不贴屋顶", status: "pass" }
      : {
          id: "C3",
          title: "单点不贴屋顶",
          status: "fail",
          detail: `当天只有一个地点，却用了 ${view.zoom} 级（应为 15）`,
        },
  );

  // ---------- D 连线 ----------
  if (!polyline) {
    results.push({
      id: "D1",
      title: "有真实道路折线",
      status: model.stops.length >= 2 ? "warn" : "pass",
      detail:
        model.stops.length >= 2
          ? "没有折线，图上会画虚线直连（图注会写「直线示意」）—— 观感差但不算错"
          : undefined,
    });
  } else {
    results.push({ id: "D1", title: "有真实道路折线", status: "pass" });

    const chunks = polyline.split(";");
    const points = chunks.map((chunk) => parseLocation(chunk.trim()));
    const badPoints = points.filter((point) => point === null).length;

    results.push(
      badPoints === 0
        ? { id: "D2", title: "折线点合法", status: "pass" }
        : {
            id: "D2",
            title: "折线点合法",
            status: "fail",
            detail: `${badPoints}/${chunks.length} 个折线点解析失败，路线会缺段`,
          },
    );

    const pixels = points
      .filter((point): point is [number, number] => point !== null)
      .map(([lng, lat]) => projectToPixel(lng, lat, view, DAY_MAP_WIDTH, DAY_MAP_HEIGHT));

    let maxJump = 0;

    for (let i = 1; i < pixels.length; i++) {
      const jump = Math.hypot(pixels[i][0] - pixels[i - 1][0], pixels[i][1] - pixels[i - 1][1]);

      if (jump > maxJump) maxJump = jump;
    }

    const limit = MAX_JUMP_RATIO * Math.hypot(DAY_MAP_WIDTH, DAY_MAP_HEIGHT);

    results.push(
      maxJump <= limit
        ? { id: "D3", title: "折线连续", status: "pass" }
        : {
            id: "D3",
            title: "折线连续",
            status: "fail",
            detail: `相邻点最大跳跃 ${maxJump.toFixed(0)}px（上限 ${limit.toFixed(0)}px），中间可能丢了整段路`,
          },
    );

    if (pixels.length >= 2) {
      const firstStop = projectToPixel(coordinates[0][0], coordinates[0][1], view, DAY_MAP_WIDTH, DAY_MAP_HEIGHT);
      const lastStop = projectToPixel(
        coordinates[coordinates.length - 1][0],
        coordinates[coordinates.length - 1][1],
        view,
        DAY_MAP_WIDTH,
        DAY_MAP_HEIGHT,
      );
      const headGap = Math.hypot(pixels[0][0] - firstStop[0], pixels[0][1] - firstStop[1]);
      const tailGap = Math.hypot(
        pixels[pixels.length - 1][0] - lastStop[0],
        pixels[pixels.length - 1][1] - lastStop[1],
      );

      results.push(
        headGap <= MAX_END_OFFSET_PX && tailGap <= MAX_END_OFFSET_PX
          ? { id: "D4", title: "折线首尾接得上", status: "pass" }
          : {
              id: "D4",
              title: "折线首尾接得上",
              status: "warn",
              detail: `起点偏差 ${headGap.toFixed(0)}px、终点偏差 ${tailGap.toFixed(0)}px（超过 ${MAX_END_OFFSET_PX}px 时看起来断头）`,
            },
      );
    }
  }

  return results;
}

/** 读方案 */
async function loadPlans(prisma: PrismaClient, planId?: number, take = 3) {
  const rows = await prisma.tripPlan.findMany({
    where: planId ? { id: planId } : undefined,
    orderBy: { id: "desc" },
    take: planId ? 1 : take,
    select: { id: true, destination: true, planJson: true },
  });

  const plans: Array<{ id: number; destination: string; plan: TravelPlan }> = [];

  for (const row of rows) {
    try {
      plans.push({
        id: row.id,
        destination: row.destination,
        plan: JSON.parse(row.planJson) as TravelPlan,
      });
    } catch (error) {
      console.error(`方案 ${row.id} 的 JSON 解析失败：${String(error)}`);
    }
  }

  return plans;
}

/** 打印一条结果 */
function renderResult(result: CheckResult): string {
  const icon = result.status === "pass" ? "✓" : result.status === "warn" ? "⚠" : "✗";

  return `${icon} ${result.id} ${result.title}${result.detail ? ` —— ${result.detail}` : ""}`;
}

async function main(): Promise<void> {
  loadEnvFile();

  const args = process.argv.slice(2);
  const planArg = args.includes("--plan") ? Number(args[args.indexOf("--plan") + 1]) : undefined;
  const plansArg = args.includes("--plans") ? Number(args[args.indexOf("--plans") + 1]) : 3;
  const verbose = args.includes("--verbose");

  const prisma = new PrismaClient();

  try {
    const plans = await loadPlans(prisma, planArg, plansArg);

    if (plans.length === 0) {
      console.log("库里没有可检查的方案");
      process.exitCode = 1;
      return;
    }

    // ---------- 全局项 ----------
    const fonts = await fontsAvailable();
    const hasKey = Boolean(process.env.AMAP_WEB_KEY?.trim());

    const globalResults: CheckResult[] = [
      fonts.ok
        ? { id: "E1", title: "服务器有可用字体", status: "pass", detail: fonts.detail }
        : { id: "E1", title: "服务器有可用字体", status: "fail", detail: fonts.detail },
      hasKey
        ? { id: "E2", title: "高德 Key 已配置", status: "pass" }
        : {
            id: "E2",
            title: "高德 Key 已配置",
            status: "fail",
            detail: "没有 AMAP_WEB_KEY，所有地图都不会生成",
          },
    ];

    const reports: PlanReport[] = [];

    for (const { id, destination, plan } of plans) {
      const days = plan.itinerary.map((day) => ({
        day: day.day,
        results: checkDay(day, plan, true),
      }));

      reports.push({ id, destination, days, global: globalResults });
    }

    // ---------- 打印 ----------
    let pass = 0;
    let warn = 0;
    let fail = 0;

    for (const report of reports) {
      console.log(`\n=== 方案 #${report.id} ${report.destination}（${report.days.length} 天）===`);

      for (const { day, results } of report.days) {
        const dayFail = results.filter((r) => r.status === "fail").length;
        const dayWarn = results.filter((r) => r.status === "warn").length;
        const mark = dayFail > 0 ? "✗" : dayWarn > 0 ? "⚠" : "✓";

        pass += results.filter((r) => r.status === "pass").length;
        warn += dayWarn;
        fail += dayFail;

        console.log(
          `  Day ${day} ${mark}（通过 ${results.length - dayFail - dayWarn}/${results.length}）`,
        );

        if (verbose) {
          for (const result of results) console.log(`    ${renderResult(result)}`);
        } else {
          for (const result of results.filter((r) => r.status !== "pass")) {
            console.log(`    ${renderResult(result)}`);
          }
        }
      }
    }

    console.log("\n=== 全局项 ===");

    for (const result of globalResults) {
      const icon = result.status === "pass" ? "✓" : "✗";

      pass += result.status === "pass" ? 1 : 0;
      fail += result.status === "fail" ? 1 : 0;
      console.log(`  ${icon} ${result.id} ${result.title}${result.detail ? ` —— ${result.detail}` : ""}`);
    }

    const total = pass + warn + fail;

    console.log(`\n=== 结论 ===`);
    console.log(`  通过 ${pass}/${total}，警告 ${warn}，必须修 ${fail}`);
    console.log(
      fail === 0
        ? "  ✓ 自动项全部通过。剩下 3 条人工项（M1–M3，见 ai-context/TRAVEL_MAP_ACCEPTANCE.md）：打开一张图核对编号可读、图注文字、Word 里的图。"
        : "  ✗ 有必须修的项，按上面的 ✗ 逐条处理；清单说明见 ai-context/TRAVEL_MAP_ACCEPTANCE.md。",
    );

    process.exitCode = fail === 0 ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error("检查失败：", error);
  process.exitCode = 1;
});
