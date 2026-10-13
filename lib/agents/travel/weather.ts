/**
 * 行程天气：和风天气优先，高德兜底。
 *
 * 为什么两个都要：
 *   - 和风天气「天气和环境」分组每月前 5 万次免费、覆盖全球、可查 10 天；
 *   - 高德天气每月仅 5000 次，且只覆盖中国境内、仅未来数日。
 * 因此和风优先；未配置和风时退回高德，两者都没有则不附天气。
 *
 * 和风天气要求使用控制台分配的专属 API Host（旧的公共地址会返回
 * 403 Invalid Host），因此 Host 必须通过 QWEATHER_HOST 配置。
 */

import type { DailyWeather } from "./types";

const REQUEST_TIMEOUT_MS = 10_000;

/** 和风天气每日预报最多支持 10 天 */
const QWEATHER_FORECAST_DAYS = 10;

/** 高德天气接口地址 */
const AMAP_HOST = "https://restapi.amap.com";

function readEnv(name: string): string | null {
  const raw = process.env[name];

  if (!raw) {
    return null;
  }

  const trimmed = raw.trim().replace(/^\uFEFF/, "").replace(/^["']|["']$/g, "");

  return trimmed.length > 0 ? trimmed : null;
}

/** 是否已配置和风天气 */
export function isQWeatherConfigured(): boolean {
  return readEnv("QWEATHER_KEY") !== null;
}

/** 天气查询结果 */
export interface WeatherResult {
  days: DailyWeather[];
  /** 实际使用的数据来源，用于告警文案 */
  source: string;
  /** 可读告警，无则为 null */
  warning: string | null;
}

/** 带超时的 GET */
async function httpGet(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** 罗盘方位代码 → 中文风向 */
const COMPASS_LABELS: Record<string, string> = {
  n: "北",
  nne: "北东北",
  ne: "东北",
  ene: "东东北",
  e: "东",
  ese: "东东南",
  se: "东南",
  sse: "南东南",
  s: "南",
  ssw: "南西南",
  sw: "西南",
  wsw: "西西南",
  w: "西",
  wnw: "西西北",
  nw: "西北",
  nnw: "北西北",
  none: "无",
  vrb: "风向不定",
};

/**
 * 把和风天气的 v1 每日预报转成内部结构。
 *
 * 和风默认返回 UTC 时间，这里显式请求 localTime=true，
 * 让 forecastStartTime 直接是当地日期，避免跨时区把日期算错一天。
 */
export function mapQWeatherDays(days: Array<Record<string, unknown>>): DailyWeather[] {
  const result: DailyWeather[] = [];

  for (const day of days) {
    const startTime = typeof day.forecastStartTime === "string" ? day.forecastStartTime : "";

    // 取日期部分即可：localTime=true 时已是当地日期
    const date = startTime.slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      continue;
    }

    const daytime = (day.daytime ?? {}) as Record<string, unknown>;
    const nighttime = (day.nighttime ?? {}) as Record<string, unknown>;

    const dayCondition = (daytime.condition ?? {}) as Record<string, unknown>;
    const nightCondition = (nighttime.condition ?? {}) as Record<string, unknown>;

    const dayWind = (daytime.wind ?? {}) as Record<string, unknown>;
    const direction = (dayWind.direction ?? {}) as Record<string, unknown>;

    const round = (value: unknown): string => {
      const num = Number(value);

      return Number.isFinite(num) ? String(Math.round(num)) : "";
    };

    result.push({
      date,
      dayWeather: typeof dayCondition.text === "string" ? dayCondition.text : "",
      nightWeather: typeof nightCondition.text === "string" ? nightCondition.text : "",
      dayTemp: round((day.temperatureMax as Record<string, unknown>)?.value),
      nightTemp: round((day.temperatureMin as Record<string, unknown>)?.value),
      windDirection: COMPASS_LABELS[String(direction.compass ?? "")] ?? "",
      windPower: Number.isFinite(Number(dayWind.scale)) ? String(dayWind.scale) : "",
    });
  }

  return result;
}

/** 查询和风天气 10 日预报；未配置或失败返回 null */
async function fetchQWeather(location: string): Promise<WeatherResult | null> {
  const key = readEnv("QWEATHER_KEY");

  if (!key) {
    return null;
  }

  const host = readEnv("QWEATHER_HOST");

  if (!host) {
    return {
      days: [],
      source: "和风天气",
      warning:
        "已配置 QWEATHER_KEY 但缺少 QWEATHER_HOST；和风天气需使用控制台分配的专属 API Host，" +
        "请在 .env.local 补充后重试",
    };
  }

  const [lng, lat] = location.split(",").map(Number);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  try {
    // lang=zh 必填：和风默认按查询地点的当地语言返回天气描述。
    // 实测不加时，东京返回「晴れ／曇り」、巴黎返回「Averses／Ensoleillé」，
    // 与中文页面混排后用户看不懂。
    const url =
      `${host.replace(/\/+$/, "")}/weather/v1/daily/` +
      `${lat.toFixed(2)}/${lng.toFixed(2)}` +
      `?days=${QWEATHER_FORECAST_DAYS}&localTime=true&lang=zh`;

    const response = await httpGet(url, { "X-QW-Api-Key": key });

    if (!response.ok) {
      return {
        days: [],
        source: "和风天气",
        warning: `和风天气返回 HTTP ${response.status}，未附天气信息`,
      };
    }

    const payload = (await response.json()) as Record<string, unknown>;

    // 新版错误格式为 { error: {...} }，旧版为 { code: "..." }
    if (payload.error) {
      const error = payload.error as Record<string, unknown>;

      return {
        days: [],
        source: "和风天气",
        warning: `和风天气接口报错：${String(error.title ?? "未知")}${
          error.detail ? ` —— ${String(error.detail)}` : ""
        }`,
      };
    }

    const days = Array.isArray(payload.days) ? (payload.days as Array<Record<string, unknown>>) : [];

    return { days: mapQWeatherDays(days), source: "和风天气", warning: null };
  } catch {
    return { days: [], source: "和风天气", warning: "和风天气请求失败，未附天气信息" };
  }
}

/** 查询高德天气（仅中国境内、未来数日）；失败返回 null */
async function fetchAmapWeather(adcode: string): Promise<WeatherResult | null> {
  const key = readEnv("AMAP_WEB_KEY") ?? readEnv("AMAP_KEY");

  if (!key || !adcode) {
    return null;
  }

  try {
    const url =
      `${AMAP_HOST}/v3/weather/weatherInfo?city=${encodeURIComponent(adcode)}` +
      `&extensions=all&key=${encodeURIComponent(key)}`;

    const response = await httpGet(url);

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;

    if (payload.status !== "1") {
      return null;
    }

    const forecasts = (payload.forecasts ?? []) as Array<Record<string, unknown>>;
    const casts = (forecasts[0]?.casts ?? []) as Array<Record<string, string>>;

    const days: DailyWeather[] = casts.map((cast) => ({
      date: cast.date ?? "",
      dayWeather: cast.dayweather ?? "",
      nightWeather: cast.nightweather ?? "",
      dayTemp: cast.daytemp ?? "",
      nightTemp: cast.nighttemp ?? "",
      windDirection: cast.daywind ?? "",
      windPower: cast.daypower ?? "",
    }));

    return { days, source: "高德", warning: null };
  } catch {
    return null;
  }
}

/**
 * 获取行程天气：和风优先、高德兜底。
 *
 * @param location "lng,lat"，两国服务都用它定位
 * @param adcode   高德 adcode；中国境内由行程增强阶段提供
 */
export async function fetchTravelWeather(
  location: string | null,
  adcode?: string,
): Promise<WeatherResult> {
  if (location) {
    const qweather = await fetchQWeather(location);

    if (qweather && qweather.days.length > 0) {
      return qweather;
    }

    // 和风配了但没查到（或报错），继续尝试高德
    if (qweather?.warning && !adcode) {
      return qweather;
    }

    if (qweather?.warning && adcode) {
      const amap = await fetchAmapWeather(adcode);

      return amap && amap.days.length > 0 ? amap : qweather;
    }
  }

  if (adcode) {
    const amap = await fetchAmapWeather(adcode);

    if (amap && amap.days.length > 0) {
      return amap;
    }
  }

  return { days: [], source: "未知", warning: null };
}
