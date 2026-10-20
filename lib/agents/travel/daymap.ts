/**
 * 逐日行程路线图：高德底图 + 我们自己画的编号标注与连线。
 *
 * ## 为什么不再直接用高德静态图的 markers 参数
 *
 * 高德 `markers=size,color,label:location` 的 label 只支持**单个字符**，
 * 且字号是固定的，实测 640×300 的图上编号只有几个像素高，缩在标记针尖下方，
 * 基本读不出来；点位靠近时标记还会互相压住。于是得到一张「有图但没用」的
 * 结果：看不出先后顺序，也看不出连线关系。
 *
 * 现在的做法：
 *   1. 只向高德要**底图**（显式 location + zoom，不带 markers）
 *   2. 按 Web 墨卡托自行投影，用 SVG 叠加编号圆点与路线
 *   3. sharp 合成成 PNG，网页与 Word 导出共用同一张图
 *
 * 投影一致性已实测验证：按同一公式算出的坐标，正好落在高德自己画的
 * marker 针尖上（见 ai-context/AI_TROUBLESHOOTING_GUIDE.md）。
 *
 * ## 两个刻意没有做的东西
 *
 *   · **方向箭头**：试过白色箭头与「蓝底白边三角」两种画法，实测都会把
 *     蓝线切出一道白色缺口，看起来像路线断了（北京第 3 天尤其明显）。
 *     先后顺序已由编号表达，宁要一条连续的路，不要断掉的箭头。
 *   · **图内文字图例**：sharp 渲染中文依赖系统字体，容器里未必有。
 *     图例放在网页与 Word 正文里，用与图上一致的编号即可。
 */

import { createHash } from "node:crypto";

import {
  DAY_MAP_HEIGHT,
  DAY_MAP_SCALE,
  DAY_MAP_WIDTH,
  buildDayMapModel,
  fitDayView,
  parseLocation,
  projectToPixel,
  simplifyPathPixels,
} from "./daymap-core";
import type { DayMapStop, DayMapView } from "./daymap-core";
import type { ItineraryDay, TravelPlan } from "./types";

/** 高德静态图端点 */
const STATIC_MAP_URL = "https://restapi.amap.com/v3/staticmap";

/** 路线颜色：与标注的红区分开，避免「线也是它、点也是它」 */
const ROUTE_COLOR = "#1B6FE0";

/** 标注配色 */
const BADGE_FILL = "#E03131";
const BADGE_STROKE = "#FFFFFF";
const BADGE_TEXT = "#FFFFFF";

/** 编号圆点半径（CSS 像素）。实际出图按 scale 放大 */
const BADGE_RADIUS = 15;

/** 路线线宽（CSS 像素） */
const ROUTE_WIDTH = 4.2;

/** 单次取底图的超时（毫秒） */
const FETCH_TIMEOUT_MS = 15_000;

/** 取底图的重试次数与间隔（高德限流时会返回 JSON 而非图片） */
const RETRY_TIMES = 2;
const RETRY_DELAY_MS = 700;

/** 进程内缓存上限（张）。一张约 130–470KB，30 张约 10MB */
const CACHE_LIMIT = 30;

/** 缓存有效期（毫秒） */
const CACHE_TTL_MS = 60 * 60 * 1000;

/** 缓存项 */
interface CacheEntry {
  data: Buffer;
  at: number;
}

const cache = new Map<string, CacheEntry>();

/** sharp 的类型别名（它只存在于服务端） */
type SharpFactory = typeof import("sharp").default;

/**
 * 懒加载 sharp。
 *
 * 它是 Next 的**可选依赖**（next 的 optionalDependencies 里声明），
 * 绝大多数安装都会装上，但不是硬保证。用动态 import + 捕获，
 * 缺了只是退化为兜底路径，而不是让接口直接 500。
 */
let sharpLoader: Promise<SharpFactory | null> | null = null;

async function loadSharp(): Promise<SharpFactory | null> {
  if (!sharpLoader) {
    sharpLoader = import("sharp")
      .then((mod) => (mod.default ?? (mod as unknown as SharpFactory)) as SharpFactory)
      .catch(() => null);
  }

  return sharpLoader;
}

/** 等待指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 是否已配置高德 Key */
export function isDayMapConfigured(): boolean {
  return Boolean(process.env.AMAP_WEB_KEY?.trim());
}

/**
 * 构造底图 URL：只要底图，不带 markers / paths。
 *
 * 注意 size 与 scale 的组合：size 是 CSS 尺寸，scale=2 时高德返回
 * 两倍像素的图（实测 size=720*405&scale=2 → 1440×810）。
 */
export function buildBaseMapUrl(
  view: DayMapView,
  width = DAY_MAP_WIDTH,
  height = DAY_MAP_HEIGHT,
  scale = DAY_MAP_SCALE,
): string | null {
  const key = process.env.AMAP_WEB_KEY?.trim();

  if (!key) return null;

  const params = [
    `size=${width}*${height}`,
    `zoom=${view.zoom}`,
    `location=${view.center[0].toFixed(6)},${view.center[1].toFixed(6)}`,
    `scale=${scale}`,
    `key=${key}`,
  ];

  return `${STATIC_MAP_URL}?${params.join("&")}`;
}

/** 取一张底图。失败返回 null（被识别为非图片的内容也按失败处理） */
async function fetchBaseMap(url: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= RETRY_TIMES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });

      if (res.ok) {
        const type = res.headers.get("content-type") || "";

        if (type.includes("image")) {
          const data = Buffer.from(await res.arrayBuffer());

          // 高德出错时返回 JSON，体积通常很小；正常图片不会小于 1KB
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

/** 画布内的一个像素点 */
interface PixelPoint {
  x: number;
  y: number;
}

/** 折线转为画布像素坐标并抽稀 */
function routePixels(
  polyline: string | null | undefined,
  view: DayMapView,
  width: number,
  height: number,
  scale: number,
): PixelPoint[] {
  if (!polyline) return [];

  const points: Array<[number, number]> = [];

  for (const chunk of polyline.split(";")) {
    const point = parseLocation(chunk.trim());

    if (!point) continue;

    const [x, y] = projectToPixel(point[0], point[1], view, width, height);

    points.push([x * scale, y * scale]);
  }

  return simplifyPathPixels(points, 2 * scale).map(([x, y]) => ({ x, y }));
}

/** 把点列转成 SVG path 的 d 属性 */
function toPathData(points: PixelPoint[]): string {
  if (points.length === 0) return "";

  return points
    .map((p, index) => `${index === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

/**
 * 解决编号重叠：点位靠得很近时（实测北海公园与景山公园相距 300 米），
 * 直接按坐标画会把两个编号叠在一起。这里按固定方向依次试探，
 * 找一个不与已放置的圆点重叠的位置。
 */
function placeBadges(targets: PixelPoint[], radius: number): PixelPoint[] {
  const placed: PixelPoint[] = [];
  const minGap = radius * 2.15;

  for (const target of targets) {
    if (!placed.some((p) => Math.hypot(p.x - target.x, p.y - target.y) < minGap)) {
      placed.push({ ...target });
      continue;
    }

    let chosen: PixelPoint | null = null;

    // 八个方向、三档距离，先近后远
    for (const distance of [minGap, minGap * 1.6, minGap * 2.2]) {
      for (let step = 0; step < 8; step++) {
        const angle = (Math.PI / 4) * step;
        const candidate = {
          x: target.x + Math.cos(angle) * distance,
          y: target.y + Math.sin(angle) * distance,
        };

        if (!placed.some((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) < minGap)) {
          chosen = candidate;
          break;
        }
      }

      if (chosen) break;
    }

    placed.push(chosen ?? { ...target });
  }

  return placed;
}

/** 生成叠加层 SVG（尺寸为出图像素，即 CSS 尺寸 × scale） */
function buildOverlaySvg(input: {
  stops: DayMapStop[];
  view: DayMapView;
  route: PixelPoint[];
  width: number;
  height: number;
  scale: number;
}): string {
  const { stops, view, route, width, height, scale } = input;
  const imageWidth = width * scale;
  const imageHeight = height * scale;

  // 标注点先按 CSS 像素定位，再整体放大
  const targets: PixelPoint[] = stops.map((stop) => {
    const point = parseLocation(stop.location) as [number, number];
    const [x, y] = projectToPixel(point[0], point[1], view, width, height);

    return { x: x * scale, y: y * scale };
  });

  const radius = BADGE_RADIUS * scale;
  const badgePoints = placeBadges(targets, radius);

  const routeParts: string[] = [];

  if (route.length >= 2) {
    const pathData = toPathData(route);

    // 白色描边打底：底图的道路与文字都是浅色，单靠一条蓝线会糊在一起
    routeParts.push(
      `<path d="${pathData}" fill="none" stroke="#FFFFFF" stroke-width="${(ROUTE_WIDTH + 3.3) * scale}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`,
    );
    routeParts.push(
      `<path d="${pathData}" fill="none" stroke="${ROUTE_COLOR}" stroke-width="${ROUTE_WIDTH * scale}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  } else if (badgePoints.length >= 2) {
    // 没有真实折线时用虚线直连，样式上明确「这是示意，不是实际道路」
    const straight = toPathData(badgePoints);

    routeParts.push(
      `<path d="${straight}" fill="none" stroke="#FFFFFF" stroke-width="${(ROUTE_WIDTH + 3) * scale}" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>`,
    );
    routeParts.push(
      `<path d="${straight}" fill="none" stroke="${ROUTE_COLOR}" stroke-width="${(ROUTE_WIDTH - 0.8) * scale}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${9 * scale} ${7 * scale}"/>`,
    );
  }

  const badgeParts = stops.map((stop, index) => {
    const point = badgePoints[index];
    const label = String(stop.number);
    const fontSize = radius * (label.length > 1 ? 0.86 : 1.02);

    // 起点多一道外环，方便第一眼找到出发位置
    const startRing =
      stop.number === 1
        ? `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${(radius + 7 * scale).toFixed(1)}" fill="none" stroke="#FFFFFF" stroke-width="${(2.4 * scale).toFixed(1)}" opacity="0.9"/>`
        : "";

    return `${startRing}
    <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${(radius + 3 * scale).toFixed(1)}" fill="#FFFFFF" opacity="0.95"/>
    <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${BADGE_FILL}" stroke="${BADGE_STROKE}" stroke-width="${(2.4 * scale).toFixed(1)}"/>
    <text x="${point.x.toFixed(1)}" y="${(point.y + radius * 0.02).toFixed(1)}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="bold" fill="${BADGE_TEXT}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}">
${routeParts.join("\n")}
${badgeParts.join("\n")}
</svg>`;
}

/** 计算一次渲染的缓存键 */
function cacheKey(parts: unknown): string {
  return createHash("sha1").update(JSON.stringify(parts)).digest("hex");
}

/** 读缓存（命中后挪到队尾，近似 LRU） */
function readCache(key: string): Buffer | null {
  const hit = cache.get(key);

  if (!hit) return null;

  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  cache.delete(key);
  cache.set(key, hit);

  return hit.data;
}

/** 写缓存并淘汰最旧的一条 */
function writeCache(key: string, data: Buffer): void {
  cache.set(key, { data, at: Date.now() });

  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;

    if (oldest === undefined) break;

    cache.delete(oldest);
  }
}

/**
 * 渲染一天的地图。
 *
 * @param stops 当天标注点（已按游览顺序编号）
 * @param routePolyline 真实道路折线；为空时用虚线直连
 * @returns PNG 数据；未配置 Key、sharp 缺失或取底图失败时返回 null
 */
export async function renderDayMapPng(input: {
  stops: DayMapStop[];
  routePolyline?: string | null;
  width?: number;
  height?: number;
  scale?: number;
}): Promise<Buffer | null> {
  const { stops, routePolyline } = input;
  const width = input.width ?? DAY_MAP_WIDTH;
  const height = input.height ?? DAY_MAP_HEIGHT;
  const scale = input.scale ?? DAY_MAP_SCALE;

  const located = stops
    .map((stop) => ({ stop, point: parseLocation(stop.location) }))
    .filter((item): item is { stop: DayMapStop; point: [number, number] } => item.point !== null);

  if (located.length === 0) return null;

  // 没配 Key 就没底图，不必先加载 sharp
  if (!isDayMapConfigured()) return null;

  const sharp = await loadSharp();

  if (!sharp) return null;

  const key = cacheKey({
    points: located.map((item) => [item.stop.number, item.stop.location]),
    routePolyline: routePolyline ?? null,
    width,
    height,
    scale,
  });
  const cached = readCache(key);

  if (cached) return cached;

  // 折线采样点参与取景，避免路线跑到画面外
  const samples: Array<[number, number]> = [];

  if (routePolyline) {
    const chunks = routePolyline.split(";");

    for (let i = 0; i < chunks.length; i += 6) {
      const point = parseLocation(chunks[i].trim());

      if (point) samples.push(point);
    }
  }

  const view = fitDayView([...located.map((item) => item.point), ...samples], width, height);

  if (!view) return null;

  const url = buildBaseMapUrl(view, width, height, scale);

  if (!url) return null;

  const base = await fetchBaseMap(url);

  if (!base) return null;

  const route = routePixels(routePolyline, view, width, height, scale);
  const svg = buildOverlaySvg({
    stops: located.map((item) => item.stop),
    view,
    route,
    width,
    height,
    scale,
  });

  try {
    const png = await sharp(base)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    writeCache(key, png);

    return png;
  } catch (error) {
    console.error("[travel] 地图合成失败", { error: String(error) });

    return null;
  }
}

/**
 * 渲染方案里某一天的路线图（网页与 Word 导出共用）。
 *
 * @returns PNG；该天没有坐标时返回 null
 */
export async function renderPlanDayMapPng(
  plan: TravelPlan,
  day: ItineraryDay,
): Promise<Buffer | null> {
  const { stops } = buildDayMapModel(day);

  if (stops.length === 0) return null;

  return renderDayMapPng({
    stops,
    routePolyline: plan.dayRoutePolylines?.[day.day] ?? null,
  });
}
