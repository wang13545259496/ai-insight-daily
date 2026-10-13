/**
 * 高德地图接入：POI 校验、真实通勤。
 *
 * 作用：把模型生成的「浅草寺 → 上野」这类文字描述，换成有坐标、
 * 有真实通勤时间与距离的可执行行程。
 *
 * 配额约束（个人认证开发者，见官方定价页）：
 *   - 基础 LBS 服务（地理编码、路径规划）  150,000 次/月
 *   - 基础搜索服务（POI 搜索）               5,000 次/月  ← 最紧张
 * 因此实现上必须省着用：只对活动点位做地理编码（不批量搜 POI），
 * 每天最多算若干段通勤，结果按「城市 + 名称」缓存。
 *
 * 覆盖范围：仅中国大陆、香港、澳门。境外目的地由调用方
 * （planner）在更早的环节跳过本模块，不会产生无用请求。
 */

import type { CommuteLeg, ItineraryActivity, ItineraryDay } from "./types";

export type { CommuteLeg };

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

/**
 * 地理编码的并发数。
 *
 * 实测：并发 5 会打爆高德的单 Key QPS 限制（10021
 * CUQPS_HAS_EXCEEDED_THE_LIMIT），连串行请求都被拒，
 * 结果被 catch 静默转成 null，表现为「大量活动无法定位」。
 * 因此这里取保守值，并配合下面的退避重试。
 */
const GEOCODE_CONCURRENCY = 2;

/** 通勤查询的并发数：每段可能发 1-3 个请求，比地理编码更保守 */
const COMMUTE_CONCURRENCY = 2;

/** 命中 QPS 限制后的退避等待（毫秒） */
const RATE_LIMIT_BACKOFF_MS = [600, 1500];

/** 高德「QPS 超限」错误码 */
const AMAP_QPS_EXCEEDED = "10021";

/**
 * 打车费估算参数（国内多数城市的通用计价方式）。
 * 用于在接口不提供打车费时给出可解释的估算值。
 */
const TAXI_BASE_FARE = 13;
const TAXI_BASE_KM = 3;
const TAXI_PER_KM = 2.6;

/**
 * 上一次行程增强期间，退避重试后仍被限流的次数。
 *
 * 为什么需要它：限流被重试消化掉时不该打扰用户，但重试仍失败时
 * 表现是「某地点不存在」，用户会以为地名有问题。这个计数让调用方
 * 能给出「接口访问受限，请稍后重试」这种可理解的说明。
 */
let lastRateLimitFailures = 0;

/** 读取并清零限流失败计数 */
export function consumeRateLimitFailures(): number {
  const count = lastRateLimitFailures;
  lastRateLimitFailures = 0;

  return count;
}

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
  /** 高德 adcode */
  adcode: string;
}

/** 行程增强结果 */
export interface AmapEnrichment {
  /** 增强后的行程 */
  itinerary: ItineraryDay[];
  /** 目的地中心坐标 "lng,lat"，供天气查询复用 */
  cityCenter: string | null;
  /** 目的地 adcode，供高德天气查询复用 */
  adcode: string | null;
  /** 驾车段预估打车费合计（元） */
  taxiCost: number;
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
async function amapGet<T extends AmapResponse>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const key = readKey();

  if (!key) {
    throw new Error("高德 Key 未配置");
  }

  const query = new URLSearchParams({ ...params, key });

  // 高德对单 Key 有 QPS 限制，超限返回 10021。这类错误是暂时的，
  // 退避重试即可；不重试会把限流当成「地点不存在」，静默丢掉数据。
  for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFF_MS.length; attempt++) {
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

      if (payload.status === "1") {
        return payload;
      }

      if (payload.infocode === AMAP_QPS_EXCEEDED) {
        if (attempt < RATE_LIMIT_BACKOFF_MS.length) {
          await sleep(RATE_LIMIT_BACKOFF_MS[attempt]);
          continue;
        }

        // 重试耗尽仍被限流：记账，交由调用方给出可理解的告警
        lastRateLimitFailures++;
      }

      throw new Error(`高德接口返回错误：${payload.info ?? "未知"}（${payload.infocode ?? "-"}）`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("高德接口重试后仍失败");
}

/** 等待指定毫秒 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 清洗地点文本，提高地理编码命中率。
 *
 * 实测「陈麻婆豆腐（骡马市店）」这类带全角括号的店名会返回
 * ENGINE_RESPONSE_DATA_ERROR(30001)，而高德解析不了括号后缀。
 * 去掉后缀后通常能命中主店名或街区。
 */
export function normalizePlaceText(raw: string): string {
  return raw
    .replace(/[（(][^）)]*[）)]/g, "") // 去掉括号及其内容
    .replace(/(附近|周边|一带|沿线|区域)$/g, "") // 去掉模糊方位词
    .replace(/\s+/g, "")
    .trim();
}

/**
 * 受控并发地按顺序处理数组。
 *
 * 为什么不用 Promise.all 一次性发完：高德对单 Key 有 QPS 限制，
 * 二十多个请求一起发容易触发 10004（访问过于频繁）。这里限制同时在飞的
 * 请求数，把等待从「次数 × 单次延迟」压到约「批数 × 单次延迟」，
 * 又不会打爆限流。结果顺序与输入一致。
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);

  if (items.length === 0) {
    return results;
  }

  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;

      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);

  return results;
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

/** 解析城市，拿到 adcode 与中心坐标；找不到返回 null */
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
 * 两个关键点，都是实测踩出来的：
 *
 * 1. **必须用 adcode 而非城市名做限定。**
 *    实测「长江索道新华路站」在 city=重庆 时被解析到贵州省关岭县索大道，
 *    「南山泉水鸡一条街」解析到辽宁省宽甸县，「山城第三步道」解析到
 *    河南省鹤壁市山城区——高德会把这些名字当成外地同名路名。
 *    改用 adcode（如重庆 500000）后全部正确落在本市。
 *
 * 2. **必须校验返回结果的 adcode 前缀。**
 *    即便加了限定，个别地点仍可能匹配到外地。错误的坐标比没有坐标更糟：
 *    它会生成一段看起来合理的假通勤，用户无从分辨。
 *    因此这里直接丢弃不属于本市的解析结果。
 */
export async function geocodePlace(
  city: string,
  name: string,
  adcode?: string,
): Promise<GeoPoint | null> {
  const cleaned = normalizePlaceText(name);

  // 太短或明显不是地名的文本没必要查
  if (cleaned.length < 2 || cleaned.length > 40) {
    return null;
  }

  const cacheK = cacheKey(adcode ?? city, cleaned);

  const cached = geocodeCache.get(cacheK);

  if (cached !== undefined) {
    return cached;
  }

  // 先用清洗后的文本查；失败时再用原文查一次（有些地名括号是正式名称的一部分）
  const candidates = cleaned === name.trim() ? [cleaned] : [cleaned, name.trim()];

  let point: GeoPoint | null = null;

  for (const address of candidates) {
    try {
      const payload = await amapGet<AmapResponse & { geocodes?: Array<Record<string, string>> }>(
        "/v3/geocode/geo",
        // 传 citycode/adcode 时高德才做严格的城市限定
        { address, city: adcode ?? city },
      );

      const first = payload.geocodes?.[0];

      if (!first?.location) {
        continue;
      }

      // 越界校验：adcode 前两位是省级编码，必须与目的地一致
      if (adcode && first.adcode && first.adcode.slice(0, 2) !== adcode.slice(0, 2)) {
        console.warn("[travel] 地理编码结果不在目标城市，已丢弃", {
          name: cleaned,
          expected: adcode,
          got: first.adcode,
          address: first.formatted_address,
        });

        break;
      }

      point = {
        location: first.location,
        formattedAddress: first.formatted_address ?? address,
        city: first.city ?? city,
        adcode: first.adcode ?? "",
      };

      break;
    } catch {
      // 单次失败继续尝试下一个候选文本
    }
  }

  geocodeCache.set(cacheK, point);

  return point;
}

// ============================================================
// 通勤
// ============================================================

/** 两点距离（米），Haversine 公式，用于筛选候选出行方式 */
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

/** 由直线距离选择默认出行方式：近距离步行，其余公交 */
export function pickMode(straightMeters: number): CommuteLeg["mode"] {
  return straightMeters <= 1200 ? "walk" : "transit";
}

/** 米转成易读的距离文本 */
function formatKm(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 米`;
}

interface ModeResult {
  distanceMeters: number;
  durationMinutes: number;
  summary: string;
  /** 驾车方案的预估打车费（元） */
  taxiCost?: number;
}

/** 只查步行方案 */
async function queryWalking(from: string, to: string): Promise<ModeResult | null> {
  const payload = await amapGet<
    AmapResponse & { route?: { paths?: Array<{ distance?: string; duration?: string }> } }
  >("/v3/direction/walking", { origin: from, destination: to });

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
  adcode: string | undefined,
  from: string,
  to: string,
): Promise<ModeResult | null> {
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
    origin: from,
    destination: to,
    // 公交规划同样优先用城市码，避免同名城市的干扰
    city: adcode ?? city,
    cityd: adcode ?? city,
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

/**
 * 按里程估算打车费（元）。
 *
 * 为什么不直接取接口字段：实测高德 v3 驾车接口的返回字段只有
 * distance / duration / strategy / tolls / toll_distance / steps /
 * restriction / traffic_lights，**没有 taxi_cost**。
 * 因此用国内多数城市的通用计价方式估算：
 * 起步价覆盖前 3 公里，之后按里程累加。
 *
 * 这是可解释的经验值，不是真实报价；调用方在文案里会标注为「估算」。
 */
export function estimateTaxiFare(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return 0;
  }

  const km = distanceMeters / 1000;

  return Math.round(TAXI_BASE_FARE + Math.max(0, km - TAXI_BASE_KM) * TAXI_PER_KM);
}

/** 只查驾车方案（打车参考） */
async function queryDriving(from: string, to: string): Promise<ModeResult | null> {
  const payload = await amapGet<
    AmapResponse & {
      route?: { paths?: Array<{ distance?: string; duration?: string }> };
    }
  >("/v3/direction/driving", { origin: from, destination: to, strategy: "0" });

  const path = payload.route?.paths?.[0];

  if (!path) {
    return null;
  }

  const distance = Number(path.distance ?? 0);
  const duration = Math.round(Number(path.duration ?? 0) / 60);

  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }

  // 接口不提供打车费，按里程估算
  const taxiCost = estimateTaxiFare(distance);

  return {
    distanceMeters: distance,
    durationMinutes: duration > 0 ? duration : Math.max(1, Math.round(distance / 500)),
    summary: `驾车/打车约 ${formatKm(distance)}，打车约 ${taxiCost} 元（按里程估算）`,
    taxiCost,
  };
}

/**
 * 查询两点之间的通勤方案。
 *
 * 出行方式不是拍脑袋定的：高德的公交方案常常给出绕行路线，
 * 只用「直线距离 → 单一方式」会得出离谱的耗时（例如同在亚龙湾
 * 的 8 公里被算成 75 分钟）。因此这里做多方式对比：
 *
 *   1. 按距离筛选候选方式（近距离加步行，始终含公交）
 *   2. 并行查询，取耗时最短的
 *   3. 若最短方案仍超过阈值，再补查驾车（打车往往明显更快）
 *
 * 境外或无数据时返回 null，由调用方跳过这一段。
 */
export async function fetchCommute(options: {
  city: string;
  adcode?: string;
  fromName: string;
  fromLocation: string;
  toName: string;
  toLocation: string;
}): Promise<CommuteLeg | null> {
  const { city, adcode, fromName, fromLocation, toName, toLocation } = options;

  const straight = haversineMeters(fromLocation, toLocation);

  if (straight === null) {
    return null;
  }

  try {
    const candidates: Array<{
      mode: CommuteLeg["mode"];
      run: () => Promise<ModeResult | null>;
    }> = [];

    if (straight <= WALK_CANDIDATE_LIMIT_METERS) {
      candidates.push({ mode: "walk", run: () => queryWalking(fromLocation, toLocation) });
    }

    candidates.push({
      mode: "transit",
      run: () => queryTransit(city, adcode, fromLocation, toLocation),
    });

    const settled = await Promise.all(
      candidates.map(async (candidate) => ({
        mode: candidate.mode,
        result: await candidate.run().catch(() => null),
      })),
    );

    const usable = settled
      .filter(
        (item): item is { mode: CommuteLeg["mode"]; result: ModeResult } => item.result !== null,
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
    if (best.mode === "transit" && best.result.durationMinutes > IMPLAUSIBLE_TRANSIT_MINUTES) {
      return null;
    }

    return {
      from: fromName,
      to: toName,
      distanceMeters: best.result.distanceMeters,
      durationMinutes: best.result.durationMinutes,
      mode: best.mode,
      summary: best.result.summary,
      taxiCost: best.mode === "drive" ? best.result.taxiCost : undefined,
    };
  } catch {
    return null;
  }
}

// ============================================================
// 行程增强主流程
// ============================================================

/**
 * 用高德数据增强行程。
 *
 * 做三件事：
 *   1. 解析城市坐标与 adcode（坐标供天气查询使用）
 *   2. 为每个活动做地理编码，拿到坐标与规范地址
 *   3. 计算相邻活动之间的真实通勤（方式、距离、耗时）
 *
 * 地理编码与通勤查询都采用受控并发：完全串行时二十多个活动需要
 * 15-30 秒，受控并发可压到 5-8 秒，同时避免触发高德 QPS 限制。
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

    return { itinerary, cityCenter: null, adcode: null, taxiCost: 0, warnings };
  }

  // 本次增强开始，重置限流计数
  lastRateLimitFailures = 0;

  // ---------- 1. 地理编码：拍平后受控并发 ----------
  // 阶段计时用于定位性能瓶颈：受控并发 + QPS 退避会让耗时波动很大，
  // 没有计时就只能猜。
  let phaseStart = Date.now();

  interface FlatItem {
    dayIndex: number;
    activityIndex: number;
    name: string;
  }

  const flat: FlatItem[] = [];

  itinerary.forEach((day, dayIndex) => {
    day.activities.forEach((activity, activityIndex) => {
      flat.push({
        dayIndex,
        activityIndex,
        name: activity.location?.trim() || activity.title,
      });
    });
  });

  const points = await mapWithConcurrency(flat, GEOCODE_CONCURRENCY, (item) =>
    geocodePlace(city, item.name, cityPoint.adcode),
  );

  console.info("[travel] 地理编码完成", {
    total: flat.length,
    located: points.filter((p) => p !== null).length,
    elapsedMs: Date.now() - phaseStart,
  });

  phaseStart = Date.now();

  // 建立「天:活动」到坐标的索引，避免在循环里做嵌套查找
  const pointByIndex = new Map<string, GeoPoint | null>();

  flat.forEach((item, index) => {
    pointByIndex.set(`${item.dayIndex}:${item.activityIndex}`, points[index]);
  });

  let geocodeFailures = 0;

  const enrichedDays: ItineraryDay[] = itinerary.map((day, dayIndex) => {
    const activities: ItineraryActivity[] = day.activities.map((activity, activityIndex) => {
      const point = pointByIndex.get(`${dayIndex}:${activityIndex}`) ?? null;

      if (!point) {
        geocodeFailures++;

        return activity;
      }

      return {
        ...activity,
        coordinates: point.location,
        address: point.formattedAddress,
      };
    });

    return { ...day, activities, commuteLegs: [] as CommuteLeg[] };
  });

  // ---------- 2. 通勤：先构建相邻段，再受控并发查询 ----------
  // 只保留「连续且都有坐标」的段：中间活动定位失败即断开链条，
  // 避免把不相邻的两个地点配对（否则会出现「机场 → 市区 17 公里」
  // 这种把中间行程吞掉的结果）
  interface PendingLeg {
    dayIndex: number;
    toActivityIndex: number;
    fromName: string;
    fromLocation: string;
    toName: string;
    toLocation: string;
  }

  const pending: PendingLeg[] = [];

  enrichedDays.forEach((day, dayIndex) => {
    let previous: { name: string; location: string } | null = null;
    let legsForDay = 0;

    day.activities.forEach((activity, activityIndex) => {
      if (!activity.coordinates) {
        // 链条断开：后续活动不再与更早的点配对
        previous = null;

        return;
      }

      const name = activity.location?.trim() || activity.title;

      if (previous && legsForDay < MAX_LEGS_PER_DAY) {
        const straight = haversineMeters(previous.location, activity.coordinates);

        // 同一点位不再规划，避免「步行 1 米」
        if (straight !== null && straight >= SAME_POINT_THRESHOLD_METERS) {
          pending.push({
            dayIndex,
            toActivityIndex: activityIndex,
            fromName: previous.name,
            fromLocation: previous.location,
            toName: name,
            toLocation: activity.coordinates,
          });

          legsForDay++;
        }
      }

      previous = { name, location: activity.coordinates };
    });
  });

  const legs = await mapWithConcurrency(pending, COMMUTE_CONCURRENCY, (item) =>
    fetchCommute({
      city,
      adcode: cityPoint.adcode,
      fromName: item.fromName,
      fromLocation: item.fromLocation,
      toName: item.toName,
      toLocation: item.toLocation,
    }),
  );

  console.info("[travel] 通勤查询完成", {
    legs: pending.length,
    resolved: legs.filter((l) => l !== null).length,
    elapsedMs: Date.now() - phaseStart,
  });

  // 回填通勤信息：挂在「后一个活动」上，页面上显示在它前面
  let commuteCount = 0;

  legs.forEach((leg, index) => {
    if (!leg) {
      return;
    }

    const target = pending[index];
    const day = enrichedDays[target.dayIndex];
    const activity = day?.activities[target.toActivityIndex];

    if (!day || !activity) {
      return;
    }

    day.activities[target.toActivityIndex] = { ...activity, commuteFromPrevious: leg };
    day.commuteLegs = [...(day.commuteLegs ?? []), leg];
    commuteCount++;
  });

  // 驾车段的打车费合计，供预算把市内交通计入「交通」科目
  const taxiCost = legs.reduce(
    (acc, leg) => acc + (leg?.mode === "drive" ? (leg.taxiCost ?? 0) : 0),
    0,
  );

  if (geocodeFailures > 0) {
    warnings.push(`有 ${geocodeFailures} 个活动地点未能在地图上定位，已保留原始文字描述`);
  }

  if (commuteCount === 0 && countLocated(enrichedDays) > 0) {
    warnings.push("已获取地点坐标，但未能生成通勤方案（可能是点位过近或接口无数据）");
  }

  // 限流重试耗尽时给出可理解的说明，避免被误当成「地名有问题」
  const rateLimited = consumeRateLimitFailures();

  if (rateLimited > 0) {
    warnings.push(
      `高德接口有 ${rateLimited} 次请求因访问频率受限而失败，部分地点或通勤信息可能缺失，稍后重新生成可补齐`,
    );
  }

  return {
    itinerary: enrichedDays,
    cityCenter: cityPoint.location,
    adcode: cityPoint.adcode,
    taxiCost,
    warnings,
  };
}

/** 统计已定位的活动数量 */
function countLocated(days: ItineraryDay[]): number {
  return days.reduce((acc, day) => acc + day.activities.filter((a) => a.coordinates).length, 0);
}
