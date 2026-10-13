/**
 * 高德地图接入：POI 校验、真实通勤、天气预报。
 *
 * 作用：把模型生成的「浅草寺 → 上野」这类文字描述，换成有坐标、
 * 有真实通勤时间与距离的可执行行程。
 *
 * 配额约束（个人认证开发者，见官方定价页）：
 *   - 基础 LBS 服务（地理编码、路径规划）  150,000 次/月
 *   - 基础搜索服务（POI 搜索）               5,000 次/月  ← 最紧张
 *   - 天气查询                               5,000 次/月
 * 因此实现上必须省着用：只对活动点位做地理编码（不批量搜 POI），
 * 每天只发一次路径规划请求，结果按「城市+名称」缓存。
 *
 * 覆盖范围：仅中国境内。境外目的地会返回空结果，此时静默跳过增强，
 * 行程照常生成——绝不因为缺地图数据而让整个方案失败。
 */

import type { CommuteLeg, DailyWeather, ItineraryActivity, ItineraryDay } from "./types";

export type { CommuteLeg, DailyWeather };

const AMAP_HOST = "https://restapi.amap.com";

/** 单次请求超时（毫秒） */
const REQUEST_TIMEOUT_MS = 10_000;

/** 一天内最多计算的通勤段数，避免接口调用过多 */
const MAX_LEGS_PER_DAY = 6;

/**
 * 视为「同一点」的距离阈值（米）。
 * 同一地点被解析两次会得到几乎相同的坐标，规划出「步行 1 米」这种
 * 无意义的结果，直接跳过。
 */
const SAME_POINT_THRESHOLD_METERS = 50;

/** 是否已配置高德 Key */
export function isAmapConfigured(): boolean {
  return readKey() !== null;
}

function readKey(): string | null {
  const raw = process.env.AMAP_WEB_KEY ?? process.env.AMAP_KEY;

  if (!raw) {
    return null;
  }

  const trimmed = raw.trim().replace(/^\uFEFF/, "").replace(/^["']|["']$/g, "");

  return trimmed.length > 0 ? trimmed : null;
}

/** 地理编码结果 */
export interface GeoPoint {
  /** "lng,lat" */
  location: string;
  /** 高德整理后的地址 */
  formattedAddress: string;
  /** 所属城市 */
  city: string;
  /** 高德 adcode，用于天气查询 */
  adcode: string;
}

/** 行程增强结果 */
export interface AmapEnrichment {
  /** 增强后的行程 */
  itinerary: ItineraryDay[];
  /** 逐日天气 */
  weather: DailyWeather[];
  /** 目的地 adcode，供天气或后续查询复用 */
  adcode: string | null;
  /** 可读告警 */
  warnings: string[];
}

// ============================================================
// HTTP
// ============================================================

interface AmapResponse {
  status?: string;
  info?: string;
  infocode?: string;
}

/** 带超时的 GET，返回解析后的 JSON；失败抛出便于上层统一降级 */
async function amapGet<T extends AmapResponse>(path: string, params: Record<string, string>): Promise<T> {
  const key = readKey();

  if (!key) {
    throw new Error("高德 Key 未配置");
  }

  const query = new URLSearchParams({ ...params, key });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${AMAP_HOST}${path}?${query.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`高德接口 HTTP ${response.status}`);
    }

    const payload = (await response.json()) as T;

    if (payload.status !== "1") {
      throw new Error(`高德接口返回错误：${payload.info ?? "未知"}（${payload.infocode ?? "-"}）`);
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// 地理编码（含进程内缓存）
// ============================================================

/** 缓存：城市 + 名称 → 坐标。高德的配额不便宜，同一地点不重复查 */
const geocodeCache = new Map<string, GeoPoint | null>();

/** 城市缓存：城市名 → adcode 与中心坐标 */
const cityCache = new Map<string, GeoPoint | null>();

/**
 * 清空地理编码缓存。
 *
 * 测试用：缓存是模块级的，同一进程内多个用例会互相看到对方写入的结果
 * （包括「失败返回 null」这种负缓存）。与其让生产代码去嗅探测试环境，
 * 不如把清理动作交给测试自己负责。
 */
export function clearAmapCache(): void {
  geocodeCache.clear();
  cityCache.clear();
}

function cacheKey(city: string, name: string): string {
  return `${city}::${name}`;
}

/**
 * 解析城市，拿到 adcode 与中心坐标。
 * 找不到返回 null。
 */
export async function resolveCityPoint(city: string): Promise<GeoPoint | null> {
  const cached = cityCache.get(city);

  if (cached !== undefined) {
    return cached;
  }

  try {
    const payload = await amapGet<AmapResponse & { geocodes?: Array<Record<string, string>> }>(
      "/v3/geocode/geo",
      { address: city },
    );

    const first = payload.geocodes?.[0];

    const point: GeoPoint | null = first?.location
      ? {
          location: first.location,
          formattedAddress: first.formatted_address ?? city,
          city: first.city ?? city,
          adcode: first.adcode ?? "",
        }
      : null;

    cityCache.set(city, point);

    return point;
  } catch {
    cityCache.set(city, null);

    return null;
  }
}

/**
 * 把活动地点文本解析为坐标。
 *
 * 注意：这里用地理编码而非 POI 搜索——搜索服务每月只有 5000 次，
 * 地理编码属于 15 万次的基础 LBS 配额，更适合逐点解析。
 */
export async function geocodePlace(city: string, name: string): Promise<GeoPoint | null> {
  const trimmed = name.trim();

  // 太短或明显不是地名的文本没必要查
  if (trimmed.length < 2 || trimmed.length > 40) {
    return null;
  }

  const cacheK = cacheKey(city, trimmed);

  const cached = geocodeCache.get(cacheK);

  if (cached !== undefined) {
    return cached;
  }

  try {
    // 带上城市限定，避免「第一市场」这类常见名匹配到别的城市
    const payload = await amapGet<AmapResponse & { geocodes?: Array<Record<string, string>> }>(
      "/v3/geocode/geo",
      { address: trimmed, city },
    );

    const first = payload.geocodes?.[0];

    const point: GeoPoint | null = first?.location
      ? {
          location: first.location,
          formattedAddress: first.formatted_address ?? trimmed,
          city: first.city ?? city,
          adcode: first.adcode ?? "",
        }
      : null;

    geocodeCache.set(cacheK, point);

    return point;
  } catch {
    geocodeCache.set(cacheK, null);

    return null;
  }
}

// ============================================================
// 路径规划
// ============================================================

/** 两点直线距离（米），用 Haversine 公式，用于选择出行方式 */
export function haversineMeters(a: string, b: string): number | null {
  const [aLng, aLat] = a.split(",").map(Number);
  const [bLng, bLat] = b.split(",").map(Number);

  if (![aLng, aLat, bLng, bLat].every((v) => Number.isFinite(v))) {
    return null;
  }

  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;

  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** 由直线距离选择出行方式：近距离步行，其余公交 */
export function pickMode(straightMeters: number): CommuteLeg["mode"] {
  return straightMeters <= 1200 ? "walk" : "transit";
}

/** 超过该直线距离就不再考虑步行 */
const WALK_CANDIDATE_LIMIT_METERS = 3000;

/** 超过该直线距离就不再考虑驾车（跨城长途以公交/铁路为主） */
const DRIVE_CANDIDATE_LIMIT_METERS = 30_000;

/** 首轮结果超过该分钟数时，补查驾车方案做对比 */
const DRIVE_FALLBACK_MINUTES = 45;

/**
 * 超过该分钟数的公交方案视为「接口失真」而非真实通勤。
 *
 * 典型场景：海岛类景点（如蜈支洲岛）在路网数据里位于海上，
 * 公交规划会绕行出 60 公里、171 分钟这种明显不合理的结果。
 * 把它当成真实通勤显示给用户，比不显示更糟。
 */
const IMPLAUSIBLE_TRANSIT_MINUTES = 120;

/** 只查步行方案 */
async function queryWalking(
  fromLocation: string,
  toLocation: string,
): Promise<{ distanceMeters: number; durationMinutes: number; summary: string } | null> {
  const payload = await amapGet<
    AmapResponse & { route?: { paths?: Array<{ distance?: string; duration?: string }> } }
  >("/v3/direction/walking", { origin: fromLocation, destination: toLocation });

  const path = payload.route?.paths?.[0];

  if (!path) {
    return null;
  }

  const distance = Number(path.distance ?? 0);
  const duration = Math.round(Number(path.duration ?? 0) / 60);

  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }

  return {
    distanceMeters: distance,
    durationMinutes: duration > 0 ? duration : Math.max(1, Math.round(distance / 80)),
    summary: `步行约 ${formatKm(distance)}`,
  };
}

/** 只查公交方案 */
async function queryTransit(
  city: string,
  fromLocation: string,
  toLocation: string,
): Promise<{ distanceMeters: number; durationMinutes: number; summary: string } | null> {
  const payload = await amapGet<
    AmapResponse & {
      route?: {
        transits?: Array<{
          distance?: string;
          duration?: string;
          segments?: Array<{ bus?: { buslines?: Array<{ name?: string }> } }>;
        }>;
      };
    }
  >("/v3/direction/transit/integrated", {
    origin: fromLocation,
    destination: toLocation,
    city,
    cityd: city,
    extensions: "base",
    strategy: "0",
  });

  const transit = payload.route?.transits?.[0];

  if (!transit) {
    return null;
  }

  const distance = Number(transit.distance ?? 0);
  const duration = Math.round(Number(transit.duration ?? 0) / 60);

  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }

  // 汇总用到的公交线路，最多列两条，避免说明过长
  const lines: string[] = [];

  for (const segment of transit.segments ?? []) {
    for (const line of segment.bus?.buslines ?? []) {
      if (line.name && !lines.includes(line.name)) {
        lines.push(line.name);
      }
    }
  }

  const lineText = lines.slice(0, 2).join(" / ");

  return {
    distanceMeters: distance,
    durationMinutes: duration > 0 ? duration : Math.max(1, Math.round(distance / 400)),
    summary: lineText
      ? `公交/地铁 ${lineText}，全程约 ${formatKm(distance)}`
      : `公共交通，全程约 ${formatKm(distance)}`,
  };
}

/** 只查驾车方案（打车参考） */
async function queryDriving(
  fromLocation: string,
  toLocation: string,
): Promise<{ distanceMeters: number; durationMinutes: number; summary: string } | null> {
  const payload = await amapGet<
    AmapResponse & { route?: { paths?: Array<{ distance?: string; duration?: string }> } }
  >("/v3/direction/driving", { origin: fromLocation, destination: toLocation, strategy: "0" });

  const path = payload.route?.paths?.[0];

  if (!path) {
    return null;
  }

  const distance = Number(path.distance ?? 0);
  const duration = Math.round(Number(path.duration ?? 0) / 60);

  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }

  return {
    distanceMeters: distance,
    durationMinutes: duration > 0 ? duration : Math.max(1, Math.round(distance / 500)),
    summary: `驾车/打车约 ${formatKm(distance)}`,
  };
}

/** 米转成易读的距离文本 */
function formatKm(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 米`;
}

/**
 * 查询两点之间的通勤方案。
 *
 * 出行方式不是拍脑袋定的：高德的公交方案常常给出绕行路线，
 * 只用「直线距离 → 单一方式」会得出离谱的耗时（例如同在亚龙湾
 * 的 8 公里被算成 75 分钟）。因此这里做多方式对比：
 *
 *   1. 先按距离筛选候选方式（近距离加步行，远距离加公交）
 *   2. 全部查一遍，取耗时最短的
 *   3. 若最短方案仍超过阈值，再补查驾车（打车往往明显更快）
 *
 * 境外或无数据时返回 null，由调用方跳过这一段。
 */
export async function fetchCommute(options: {
  city: string;
  fromName: string;
  fromLocation: string;
  toName: string;
  toLocation: string;
}): Promise<CommuteLeg | null> {
  const { city, fromName, fromLocation, toName, toLocation } = options;

  const straight = haversineMeters(fromLocation, toLocation);

  if (straight === null) {
    return null;
  }

  try {
    const candidates: Array<{
      mode: CommuteLeg["mode"];
      run: () => Promise<{ distanceMeters: number; durationMinutes: number; summary: string } | null>;
    }> = [];

    if (straight <= WALK_CANDIDATE_LIMIT_METERS) {
      candidates.push({ mode: "walk", run: () => queryWalking(fromLocation, toLocation) });
    }

    candidates.push({ mode: "transit", run: () => queryTransit(city, fromLocation, toLocation) });

    // 并行查询各候选方式，任一失败不影响其它
    const settled = await Promise.all(
      candidates.map(async (candidate) => ({
        mode: candidate.mode,
        result: await candidate.run().catch(() => null),
      })),
    );

    const usable = settled
      .filter((item): item is { mode: CommuteLeg["mode"]; result: NonNullable<typeof item.result> } =>
        item.result !== null,
      )
      .sort((a, b) => a.result.durationMinutes - b.result.durationMinutes);

    if (usable.length === 0) {
      return null;
    }

    let best = usable[0];

    // 仍偏慢时补查驾车：打车通常比绕行的公交快得多
    if (
      best.result.durationMinutes > DRIVE_FALLBACK_MINUTES &&
      straight <= DRIVE_CANDIDATE_LIMIT_METERS
    ) {
      const driving = await queryDriving(fromLocation, toLocation).catch(() => null);

      if (driving && driving.durationMinutes < best.result.durationMinutes) {
        best = { mode: "drive", result: driving };
      }
    }

    // 公交方案离谱到不可能时，不再把它当作真实通勤
    if (
      best.mode === "transit" &&
      best.result.durationMinutes > IMPLAUSIBLE_TRANSIT_MINUTES
    ) {
      return null;
    }

    return {
      from: fromName,
      to: toName,
      distanceMeters: best.result.distanceMeters,
      durationMinutes: best.result.durationMinutes,
      mode: best.mode,
      summary: best.result.summary,
    };
  } catch {
    return null;
  }
}

// ============================================================
// 天气
// ============================================================

/** 查询逐日天气预报；失败返回空数组 */
export async function fetchWeather(adcode: string): Promise<DailyWeather[]> {
  if (!adcode) {
    return [];
  }

  try {
    const payload = await amapGet<
      AmapResponse & {
        forecasts?: Array<{ casts?: Array<Record<string, string>> }>;
      }
    >("/v3/weather/weatherInfo", { city: adcode, extensions: "all" });

    const casts = payload.forecasts?.[0]?.casts ?? [];

    return casts.map((cast) => ({
      date: cast.date ?? "",
      dayWeather: cast.dayweather ?? "",
      nightWeather: cast.nightweather ?? "",
      dayTemp: cast.daytemp ?? "",
      nightTemp: cast.nighttemp ?? "",
      windDirection: cast.daywind ?? "",
      windPower: cast.daypower ?? "",
    }));
  } catch {
    return [];
  }
}

// ============================================================
// 行程增强主流程
// ============================================================

/**
 * 用高德数据增强行程。
 *
 * 做三件事：
 *   1. 解析城市 adcode（后续天气要用）
 *   2. 逐个活动地理编码，拿到坐标与规范地址
 *   3. 每天计算相邻活动之间的通勤（距离、耗时、线路）
 *
 * 全部为「尽力而为」：任何一步失败都只跳过该项，不影响方案本身。
 */
export async function enrichItinerary(options: {
  city: string;
  itinerary: ItineraryDay[];
}): Promise<AmapEnrichment> {
  const { city, itinerary } = options;
  const warnings: string[] = [];

  const cityPoint = await resolveCityPoint(city);

  if (!cityPoint) {
    warnings.push(
      `高德未能识别目的地「${city}」，本次未附地图信息（境外目的地无数据属正常）`,
    );

    return { itinerary, weather: [], adcode: null, warnings };
  }

  let geocodeFailures = 0;
  let commuteCount = 0;

  const enrichedDays: ItineraryDay[] = [];

  for (const day of itinerary) {
    const enrichedActivities: ItineraryActivity[] = [];

    // 只记录「连续且都有坐标」的活动段：一旦中间某个活动没有坐标，
    // 链条就断开，避免把不相邻的两个地点拿来算通勤
    // （否则会出现「机场 → 大东海 17 公里」这种把中间行程吞掉的结果）
    const chain: Array<{ index: number; name: string; location: string }> = [];
    const legs: CommuteLeg[] = [];
    let previousLocated = false;

    for (const activity of day.activities) {
      const name = activity.location?.trim() || activity.title;

      const point = await geocodePlace(city, name);

      if (!point) {
        geocodeFailures++;
        previousLocated = false;
        enrichedActivities.push(activity);
        continue;
      }

      const currentIndex = enrichedActivities.length;

      const enriched: ItineraryActivity = {
        ...activity,
        coordinates: point.location,
        address: point.formattedAddress,
      };

      // 与上一个活动相邻且两者都有坐标时，才计算通勤
      if (previousLocated && chain.length > 0 && legs.length < MAX_LEGS_PER_DAY) {
        const from = chain[chain.length - 1];

        const straight = haversineMeters(from.location, point.location);

        // 同一点位不再规划，避免「步行 1 米」
        if (straight !== null && straight >= SAME_POINT_THRESHOLD_METERS) {
          const leg = await fetchCommute({
            city,
            fromName: from.name,
            fromLocation: from.location,
            toName: name,
            toLocation: point.location,
          });

          if (leg) {
            legs.push(leg);
            commuteCount++;

            enriched.commuteFromPrevious = leg;
          }
        }
      }

      chain.push({ index: currentIndex, name, location: point.location });
      previousLocated = true;
      enrichedActivities.push(enriched);
    }

    enrichedDays.push({ ...day, activities: enrichedActivities, commuteLegs: legs });
  }

  if (geocodeFailures > 0) {
    warnings.push(`有 ${geocodeFailures} 个活动地点未能在地图上定位，已保留原始文字描述`);
  }

  if (commuteCount === 0 && countLocated(enrichedDays) > 0) {
    warnings.push("已获取地点坐标，但未能生成通勤方案（可能是点位过近或接口无数据）");
  }

  const weather = await fetchWeather(cityPoint.adcode);

  return { itinerary: enrichedDays, weather, adcode: cityPoint.adcode, warnings };
}

/** 统计已定位的活动数量 */
function countLocated(days: ItineraryDay[]): number {
  return days.reduce((acc, day) => acc + day.activities.filter((a) => a.coordinates).length, 0);
}
