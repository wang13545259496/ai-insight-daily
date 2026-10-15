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

/** 高德静态图端点 */
const STATIC_MAP_URL = "https://restapi.amap.com/v3/staticmap";

/** 图片尺寸（像素）。与前端容器保持一致，避免拉伸模糊 */
export const MAP_WIDTH = 640;
export const MAP_HEIGHT = 300;

/** 缩放级别：13 适合展示同一片区内的若干地点 */
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
 * @returns 图片 URL；坐标不足或未配置 Key 时返回 null
 */
export function buildDayMapUrl(points: MapPoint[]): string | null {
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

  // paths 用分号分隔
  const paths = `${used.length > 1 ? "5" : "0"},${ROUTE_COLOR},1,,:${used
    .map((p) => p.location)
    .join(";")}`;

  const params = [
    `size=${MAP_WIDTH}*${MAP_HEIGHT}`,
    `zoom=${DEFAULT_ZOOM}`,
    `markers=${markers}`,
    `paths=${paths}`,
    `key=${key}`,
  ];

  return `${STATIC_MAP_URL}?${params.join("&")}`;
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
