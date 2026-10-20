/**
 * 逐日路线图的**纯计算层**：编号、取景、投影、折线简化。
 *
 * 为什么单独一层：
 *   1. 页面（客户端组件 DayCard）需要知道「第几个活动对应地图上的几号」，
 *      而真正出图要用 sharp（只有服务端有）。混在一个模块里会让客户端
 *      bundle 去 require sharp，构建直接失败。
 *   2. 这些规则必须能被单测覆盖 —— 编号错了、取景框漏了点，
 *      在浏览器里只是「图看起来怪」，很难定位。
 */

import type { ItineraryDay } from "./types";

/** 画布尺寸（CSS 像素）。出图时按 scale 放大，供高分屏使用 */
export const DAY_MAP_WIDTH = 720;

/** 画布高度。16:9，与页面卡片比例一致 */
export const DAY_MAP_HEIGHT = 405;

/** 出图倍率。2 表示实际 PNG 为 1440×810 */
export const DAY_MAP_SCALE = 2;

/** 同一地点的判定精度：小数点后 5 位约 1 米 */
const SAME_POINT_DECIMALS = 5;

/** 取景时四周留白比例（占画布宽/高的比例） */
const VIEW_MARGIN = 0.12;

/** 缩放级别上下限。高德静态图支持 1–17，这里收窄到常用区间 */
const MIN_ZOOM = 4;
const MAX_ZOOM = 17;

/** 只有一处地点时用的固定缩放级别：能看到街区，又不至于贴着屋顶 */
const SINGLE_POINT_ZOOM = 15;

/** 地图上的一处标注 */
export interface DayMapStop {
  /** 从 1 开始的编号，与活动列表里的圆点一致 */
  number: number;

  /** 原始坐标 "lng,lat"（保留原精度，用于请求底图与画线） */
  location: string;

  /** 代表该点的活动名（同一地点有多个活动时取第一个） */
  title: string;

  /** 归属该点的活动下标；同一天里「前往某地」与「某地」会共享一个点 */
  activityIndexes: number[];
}

/** 一天的标注模型 */
export interface DayMapModel {
  stops: DayMapStop[];

  /** 每个活动对应的编号；无坐标的活动为 null */
  activityNumbers: Array<number | null>;
}

/** 取景结果：中心点 + 缩放级别 */
export interface DayMapView {
  center: [number, number];
  zoom: number;
}

/** 解析 "lng,lat"；非法或越界返回 null */
export function parseLocation(location: string | undefined | null): [number, number] | null {
  if (typeof location !== "string") return null;

  const parts = location.split(",");

  if (parts.length !== 2) return null;

  const lng = Number(parts[0]);
  const lat = Number(parts[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;

  return [lng, lat];
}

/**
 * 把当天的活动归并成标注点。
 *
 * 为什么按坐标合并：模型常常把「前往天坛」和「天坛公园」写成两条活动，
 * 坐标完全相同。不合并就会在同一个像素位置叠两个编号，两个都看不清。
 * 合并后两条活动共享同一个编号，与地图上的标注一一对应。
 */
export function buildDayMapModel(day: ItineraryDay): DayMapModel {
  const stops: DayMapStop[] = [];
  const byPoint = new Map<string, DayMapStop>();
  const activityNumbers: Array<number | null> = [];

  for (const [index, activity] of day.activities.entries()) {
    const point = parseLocation(activity.coordinates);

    if (!point) {
      activityNumbers.push(null);
      continue;
    }

    const key = `${point[0].toFixed(SAME_POINT_DECIMALS)},${point[1].toFixed(SAME_POINT_DECIMALS)}`;
    const existing = byPoint.get(key);

    if (existing) {
      existing.activityIndexes.push(index);
      activityNumbers.push(existing.number);
      continue;
    }

    const stop: DayMapStop = {
      number: stops.length + 1,
      location: activity.coordinates as string,
      title: activity.title,
      activityIndexes: [index],
    };

    stops.push(stop);
    byPoint.set(key, stop);
    activityNumbers.push(stop.number);
  }

  return { stops, activityNumbers };
}

/**
 * 经纬度 → 世界像素坐标（Web 墨卡托，瓦片 256px）。
 *
 * 高德静态图在显式传入 location + zoom 时按这套投影出图，
 * 因此我们能在同一张图上自己叠加标注 —— 这条已被实测验证过：
 * 按此公式算出的点，正好落在高德自己画的 marker 尖上。
 */
export function worldPixel(lng: number, lat: number, zoom: number, tileSize = 256): [number, number] {
  const scale = tileSize * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const clamped = Math.max(Math.min(lat, 85.05112877980659), -85.05112877980659);
  const sin = Math.sin((clamped * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;

  return [x, y];
}

/** 世界像素坐标 → 经纬度（worldPixel 的逆运算） */
export function pixelToLngLat(x: number, y: number, zoom: number, tileSize = 256): [number, number] {
  const scale = tileSize * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return [lng, lat];
}

/**
 * 计算能把所有点都装进画布的取景。
 *
 * 为什么不能写死 zoom=13：一天的活动可能横跨机场与市区（实测北京第 1 天
 * 跨度 60 公里），写死级别会让大部分标注落在画面外，图上只剩一片无关街区。
 *
 * @param points 参与取景的坐标（通常为标注点 + 折线采样点）
 * @returns 取景；没有合法点时返回 null
 */
export function fitDayView(
  points: Array<[number, number]>,
  width = DAY_MAP_WIDTH,
  height = DAY_MAP_HEIGHT,
): DayMapView | null {
  if (points.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // 先归一到 zoom=0 的世界坐标，之后按 2^zoom 放大即可比较
  for (const [lng, lat] of points) {
    const [x, y] = worldPixel(lng, lat, 0);

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const center = pixelToLngLat((minX + maxX) / 2, (minY + maxY) / 2, 0);

  /**
   * 单点（或几乎重合的点）没有跨度，固定级别即可。
   *
   * 判据放在「最大级别下不足 4 像素」而不是严格相等：活动坐标与折线首点
   * 常有几米偏差，严格相等会让同一天的同一地点被当成两点，级别一路顶到 17。
   */
  const spanAtMaxZoomX = (maxX - minX) * 2 ** MAX_ZOOM;
  const spanAtMaxZoomY = (maxY - minY) * 2 ** MAX_ZOOM;

  if (spanAtMaxZoomX < 4 && spanAtMaxZoomY < 4) {
    return { center, zoom: SINGLE_POINT_ZOOM };
  }

  const usableWidth = width * (1 - 2 * VIEW_MARGIN);
  const usableHeight = height * (1 - 2 * VIEW_MARGIN);
  let zoom = MAX_ZOOM;

  while (zoom > MIN_ZOOM) {
    const spanX = (maxX - minX) * 2 ** zoom;
    const spanY = (maxY - minY) * 2 ** zoom;

    if (spanX <= usableWidth && spanY <= usableHeight) break;

    zoom -= 1;
  }

  return { center, zoom };
}

/** 经纬度 → 画布内像素坐标（左上角为原点） */
export function projectToPixel(
  lng: number,
  lat: number,
  view: DayMapView,
  width = DAY_MAP_WIDTH,
  height = DAY_MAP_HEIGHT,
): [number, number] {
  const [x, y] = worldPixel(lng, lat, view.zoom);
  const [cx, cy] = worldPixel(view.center[0], view.center[1], view.zoom);

  return [width / 2 + (x - cx), height / 2 + (y - cy)];
}

/**
 * 按像素距离抽稀折线。
 *
 * 真实道路折线动辄上千点（实测单日 2 万字符），既让 SVG 体积失控，
 * 也对观感毫无帮助 —— 相隔不足 2 像素的点画出来是同一条线。
 */
export function simplifyPathPixels(
  points: Array<[number, number]>,
  minDistance = 2,
): Array<[number, number]> {
  if (points.length <= 2) return points;

  const kept: Array<[number, number]> = [points[0]];
  const minSquared = minDistance * minDistance;

  for (let i = 1; i < points.length; i++) {
    const [px, py] = kept[kept.length - 1];
    const [x, y] = points[i];
    const dx = x - px;
    const dy = y - py;

    if (dx * dx + dy * dy >= minSquared) kept.push(points[i]);
  }

  // 末点必须保留，否则路线看起来断在半路
  const last = points[points.length - 1];
  const tail = kept[kept.length - 1];

  if (tail[0] !== last[0] || tail[1] !== last[1]) kept.push(last);

  return kept;
}
