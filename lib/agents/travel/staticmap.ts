/**
 * 逐日路线静态图（高德静态图接口 /v3/staticmap）。
 *
 * 为什么用静态图而非 JS 地图：
 *   · 后端渲染即可用，不需要引入地图 SDK 与客户端状态
 *   · 一张图就能表达「当天去了哪几处、怎么走」，符合行程页的阅读场景
 *   · 免费额度充足，无需额外配置
 *
 * 参数格式的两个坑（均为实测得出，与官方文档的示例不完全一致）：
 *   1. **markers 用管道符 `|` 分隔**，用分号会返回 UNKNOWN_ERROR（20003）
 *   2. **paths 用分号 `;` 分隔**，分号编码与否都可以
 * 另外请求过密会触发 CUQPS_HAS_EXCEEDED_THE_LIMIT（10021）——
 * 但图片 URL 由浏览器按需加载，天然分散，不受此影响。
 */

import { fitDayView, parseLocation } from "./daymap-core";

/** 高德静态图端点 */
const STATIC_MAP_URL = "https://restapi.amap.com/v3/staticmap";

/** 图片尺寸（像素）。与前端容器保持一致，避免拉伸模糊 */
export const MAP_WIDTH = 640;
export const MAP_HEIGHT = 300;

/**
 * 兜底缩放级别。
 *
 * 只在 fitDayView 拿不到取景时使用。正常路径按当天点位的跨度算级别 ——
 * 写死级别会让跨度大的天把点全甩到画面外（实测北京第 1 天从大兴机场到顺义，
 * 写死 13 级时图上只剩一片无关街区）。
 */
const DEFAULT_ZOOM = 13;

/** 标记点与路线的颜色（高德用 0xRRGGBB） */
const ROUTE_COLOR = "0x1E90FF";

/** 一个地图点 */
export interface MapPoint {
  /** 坐标 "lng,lat" */
  location: string;
  /** 标记编号，从 1 开始 */
  index: number;
}

/** 是否已配置高德 Key（静态图同样需要） */
export function isStaticMapConfigured(): boolean {
  return Boolean(process.env.AMAP_WEB_KEY?.trim());
}

/** 校验坐标字符串格式（"lng,lat"，两者均为数字） */
export function isValidLocation(location: string): boolean {
  const parts = String(location || "").split(",");

  if (parts.length !== 2) return false;

  const lng = Number(parts[0]);
  const lat = Number(parts[1]);

  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * 生成一天的路线静态图 URL。
 *
 * @param points 当天有坐标的地点，按游览顺序
 * @param routePolyline 真实道路折线（可选）。有值时按它画路线，
 *        否则用各点直连 —— 直连会穿过不可通行区域
 *        （实测北京第 2 天的直连线穿过了故宫）
 * @returns 图片 URL；坐标不足或未配置 Key 时返回 null
 */
export function buildDayMapUrl(points: MapPoint[], routePolyline?: string | null): string | null {
  const key = process.env.AMAP_WEB_KEY?.trim();

  if (!key) return null;

  const valid = points.filter((p) => isValidLocation(p.location));

  // 至少两个点才值得画图：一个点无法表达「路线」
  if (valid.length < 2) return null;

  // 控制单张图的点数，避免 URL 过长（高德对 URL 长度有限制）
  const used = valid.slice(0, 8);

  // markers 用管道符分隔 —— 实测用分号会返回 UNKNOWN_ERROR
  const markers = used
    .map((p) => `large,${ROUTE_COLOR},${p.index}:${p.location}`)
    .join("|");

  // paths 用分号分隔。注意：真实折线本身也是分号分隔的坐标串，
  // 结构与直连一致，因此两种来源可以走同一段逻辑。
  const routePoints =
    routePolyline && routePolyline.length > 0
      ? routePolyline
      : used.map((p) => p.location).join(";");

  const paths = `5,${ROUTE_COLOR},1,,:${routePoints}`;

  // 按实际点位取景：跨度大的天必须缩到更小的级别才装得下
  const view = fitDayView(
    used
      .map((point) => parseLocation(point.location))
      .filter((point): point is [number, number] => point !== null),
    MAP_WIDTH,
    MAP_HEIGHT,
  );

  const params = [
    `size=${MAP_WIDTH}*${MAP_HEIGHT}`,
    `zoom=${view?.zoom ?? DEFAULT_ZOOM}`,
    ...(view ? [`location=${view.center[0].toFixed(6)},${view.center[1].toFixed(6)}`] : []),
    `markers=${markers}`,
    `paths=${paths}`,
    `key=${key}`,
  ];

  return `${STATIC_MAP_URL}?${params.join("&")}`;
}

/**
 * URL 长度上限（字符）。
 *
 * 真实道路折线比直连长得多（每个点约 20 字符），
 * 高德对 URL 长度有限制，超长会返回错误。
 * 实测一条 3 公里的城市路线 polyline 约 1500 字符，
 * 因此设置上限并对超长折线做抽稀。
 */
const MAX_URL_LENGTH = 3500;

/**
 * 抽稀折线：按等间隔保留点，使 URL 不超长。
 *
 * 为什么可以抽稀：折线用于「示意路线走向」，
 * 保留每 N 个点仍能表达形状；而标记点用的是原始坐标，位置精确。
 */
export function thinPolyline(polyline: string, maxLength = 2000): string {
  if (polyline.length <= maxLength) return polyline;

  const points = polyline.split(";").filter((p) => p.trim().length > 0);

  if (points.length <= 2) return polyline;

  // 目标点数：按当前平均每点长度反推
  const avgLen = polyline.length / points.length;
  const targetCount = Math.max(2, Math.floor(maxLength / avgLen));

  if (targetCount >= points.length) return polyline;

  const step = points.length / targetCount;
  const kept: string[] = [];

  for (let i = 0; i < targetCount; i++) {
    kept.push(points[Math.floor(i * step)]);
  }

  // 末点单独补上，避免路线终点缺失
  const last = points[points.length - 1];

  if (kept[kept.length - 1] !== last) kept.push(last);

  return kept.join(";");
}

/** 生成 URL 时对折线做长度保护 */
export function buildDayMapUrlSafe(
  points: MapPoint[],
  routePolyline?: string | null,
): string | null {
  const url = buildDayMapUrl(points, routePolyline ? thinPolyline(routePolyline) : null);

  if (!url) return null;

  // 兜底：即便抽稀后仍超长，退回直连
  if (url.length > MAX_URL_LENGTH) {
    return buildDayMapUrl(points, null);
  }

  return url;
}

/**
 * 取一天内相邻地点之间的真实道路折线，拼接成整日路线。
 *
 * 为什么要真实路线：直连会穿过不可通行区域 ——
 * 实测北京第 2 天「故宫」与「景山公园」的直连线穿过了故宫本体，
 * 用户看到会以为可以横穿。
 *
 * 成本：相邻点对数 - 1 次高德驾车请求（免费），并行发起。
 * 任一段失败时跳过该段（仍用其它段拼出的不完整路线，
 * 或最终回退直连），不因单点失败导致整天没图。
 *
 * @param locations 当天有坐标的地点，按游览顺序
 * @returns 拼接后的 polyline；全部失败时返回 null
 */
export async function buildDayRoutePolyline(
  locations: string[],
  fetchPolyline: (from: string, to: string) => Promise<string | null>,
): Promise<string | null> {
  const valid = locations.filter((l) => isValidLocation(l));

  if (valid.length < 2) return null;

  // 控制段数：点太多时只取前 6 个，避免请求数与 URL 长度失控
  const points = valid.slice(0, 6);

  const segments: Array<[string, string]> = [];

  for (let i = 0; i < points.length - 1; i++) {
    segments.push([points[i], points[i + 1]]);
  }

  const results = await Promise.all(
    segments.map(async ([from, to]) => {
      try {
        return await fetchPolyline(from, to);
      } catch {
        return null;
      }
    }),
  );

  const parts = results.filter((r): r is string => typeof r === "string" && r.length > 0);

  if (parts.length === 0) return null;

  /**
   * 拼接各段并去掉共享端点。
   *
   * 相邻两段的折线首尾相接（前段末点 = 后段首点），
   * 直接 join 会产生重复点。虽然重复点不影响渲染，
   * 但会让折线长度虚增，浪费 URL 配额。
   */
  const merged: string[] = [];

  for (const part of parts) {
    const points = part.split(";").filter((p) => p.trim().length > 0);

    for (const point of points) {
      // 与前一个已加入的点相同则跳过
      if (merged.length > 0 && merged[merged.length - 1] === point) continue;

      merged.push(point);
    }
  }

  // 只取到部分段时也返回 —— 有真实路线的一段总比整条直线更准确
  return merged.length > 0 ? merged.join(";") : null;
}

/**
 * 计算一组坐标的中心点，用作地图视野中心。
 *
 * 为什么不直接传 location：静态图在只给 markers 时会自动适配视野，
 * 但显式给出中心更稳定 —— 尤其当天的点分布在城市两端时。
 */
export function centerOf(points: MapPoint[]): string | null {
  const valid = points.filter((p) => isValidLocation(p.location));

  if (valid.length === 0) return null;

  let sumLng = 0;
  let sumLat = 0;

  for (const p of valid) {
    const [lng, lat] = p.location.split(",").map(Number);

    sumLng += lng;
    sumLat += lat;
  }

  return `${(sumLng / valid.length).toFixed(6)},${(sumLat / valid.length).toFixed(6)}`;
}
