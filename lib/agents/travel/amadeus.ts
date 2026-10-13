/**
 * Amadeus Self-Service 报价接入。
 *
 * 选用它的原因：它是少数对个人开放的机票询价接口，协议稳定（OAuth2 +
 * REST），有免费测试额度。注册地址 https://developers.amadeus.com
 *
 * 关于「真实价格」的边界，代码里也如实标注：
 * - 测试环境（test.api.amadeus.com）返回的是示例数据，价格非真实可订价
 * - 生产环境（api.amadeus.com）才返回可用于报价的数据，需签约
 * - 酒店接口的报价覆盖度有限，取不到房价时降级为估算并在 warnings 说明
 *
 * 环境变量：
 *   AMADEUS_CLIENT_ID
 *   AMADEUS_CLIENT_SECRET
 *   AMADEUS_ENV=test | production   （默认 test）
 */

import {
  CHILD_FLIGHT_RATIO,
  legsDurationMinutes,
  makeQuoteMeta,
  totalFlightPrice,
  type QuoteContext,
  type QuoteProvider,
} from "./providers";
import type { FlightLeg, FlightQuote, HotelQuote, TravelQuotes } from "./types";

/** 单次 HTTP 请求超时（毫秒） */
const REQUEST_TIMEOUT_MS = 12_000;

/** token 提前过期的安全余量（秒） */
const TOKEN_SAFETY_WINDOW_SECONDS = 60;

interface AmadeusConfig {
  clientId: string;
  clientSecret: string;
  /** API 主机，如 https://test.api.amadeus.com */
  host: string;
  /** 是否为测试环境（价格非真实可订） */
  sandbox: boolean;
}

/** 读取配置；缺任一项返回 null，由调用方切换到估算模式 */
function readConfig(): AmadeusConfig | null {
  const clientId = process.env.AMADEUS_CLIENT_ID?.trim();
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  const isProduction = (process.env.AMADEUS_ENV ?? "test").trim().toLowerCase() === "production";

  const override = process.env.AMADEUS_BASE_URL?.trim();

  const host =
    override && override.length > 0
      ? override.replace(/\/+$/, "")
      : isProduction
        ? "https://api.amadeus.com"
        : "https://test.api.amadeus.com";

  return { clientId, clientSecret, host, sandbox: !isProduction };
}

/** 是否已配置 Amadeus 凭据 */
export function isAmadeusConfigured(): boolean {
  return readConfig() !== null;
}

/** 当前是否运行在测试环境（价格非真实），用于提示文案 */
export function isAmadeusSandbox(): boolean {
  return readConfig()?.sandbox ?? true;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/** 模块级 token 缓存：Amadeus 的 token 有效期 30 分钟，每次请求都换取会浪费配额 */
let cachedToken: CachedToken | null = null;

/** 换取 access token（带缓存） */
async function getAccessToken(config: AmadeusConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetchWithTimeout(`${config.host}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await safeText(response);

    throw new Error(`Amadeus 鉴权失败（HTTP ${response.status}）：${text}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error("Amadeus 鉴权响应缺少 access_token");
  }

  const expiresIn = payload.expires_in ?? 1799;

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, expiresIn - TOKEN_SAFETY_WINDOW_SECONDS) * 1000,
  };

  return cachedToken.accessToken;
}

/** 带超时的 fetch，避免外部接口挂起拖死整个请求 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** 安全读取响应文本，失败时返回占位串 */
async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "<无法读取响应体>";
  }
}

// ============================================================
// 机票
// ============================================================

/** Amadeus 航段结构（只声明用到的字段） */
interface AmadeusSegment {
  departure?: { iataCode?: string; at?: string };
  arrival?: { iataCode?: string; at?: string };
  carrierCode?: string;
  number?: string;
}

interface AmadeusItinerary {
  duration?: string;
  segments?: AmadeusSegment[];
}

interface AmadeusFlightOffer {
  price?: { grandTotal?: string; total?: string; currency?: string };
  itineraries?: AmadeusItinerary[];
  numberOfBookableSeats?: number;
}

/** 把 Amadeus 航段转成内部航段结构，缺字段的航段直接丢弃 */
function toFlightLegs(itinerary: AmadeusItinerary | undefined): FlightLeg[] {
  const segments = itinerary?.segments ?? [];

  const legs: FlightLeg[] = [];

  for (const segment of segments) {
    const from = segment.departure?.iataCode;
    const to = segment.arrival?.iataCode;
    const departAt = segment.departure?.at;
    const arriveAt = segment.arrival?.at;

    if (!from || !to || !departAt || !arriveAt) {
      continue;
    }

    legs.push({
      from,
      to,
      departAt,
      arriveAt,
      carrier: segment.carrierCode ?? "??",
      flightNumber: `${segment.carrierCode ?? ""}${segment.number ?? ""}`.trim() || "未知",
    });
  }

  return legs;
}

/** 机票原币金额 → 人民币金额的折算（Amadeus 多数报价本身即为出票币种） */
function toCny(amount: number): number {
  return Math.round(amount);
}

/**
 * Flight Offers 接口对同行人数的硬限制。
 *
 * 依据官方 swagger：adults 最多 9 人，且「成人 + 儿童」合计不得超过 9 人；
 * 超过时接口直接返回 400，不会给出报价。本功能允许最多 30 人同行，
 * 因此人数超限时必须提前跳过询价，交给估算 Provider 处理。
 */
const MAX_SEATED_TRAVELERS = 9;

/** 查询机票报价；无可用报价时返回 null */
async function fetchFlightQuote(
  config: AmadeusConfig,
  context: QuoteContext,
): Promise<{ quote: FlightQuote | null; warnings: string[] }> {
  const warnings: string[] = [];

  // 人数超限时不发请求：既避免必然的 400，也省下一次配额消耗
  const seated = context.party.adults + context.party.children;

  if (seated > MAX_SEATED_TRAVELERS) {
    warnings.push(
      `同行 ${seated} 人超过机票询价接口上限（${MAX_SEATED_TRAVELERS} 人），已按人均估算机票费用`,
    );

    return { quote: null, warnings };
  }

  const token = await getAccessToken(config);

  const params = new URLSearchParams({
    originLocationCode: context.originCode,
    destinationLocationCode: context.destinationCode,
    departureDate: context.departDate,
    returnDate: context.returnDate,
    adults: String(context.party.adults),
    travelClass: "ECONOMY",
    currencyCode: "CNY",
    max: "5",
  });

  if (context.party.children > 0) {
    params.set("children", String(context.party.children));
  }

  const response = await fetchWithTimeout(
    `${config.host}/v1/shopping/flight-offers?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    const text = await safeText(response);

    warnings.push(`机票询价失败（HTTP ${response.status}），已改用估算：${text}`);

    return { quote: null, warnings };
  }

  const payload = (await response.json()) as { data?: AmadeusFlightOffer[] };
  const offers = payload.data ?? [];

  if (offers.length === 0) {
    warnings.push("机票接口未返回可用报价（该航线可能暂无数据），已改用估算");

    return { quote: null, warnings };
  }

  // 取总价最低的一档：预算规划场景下，最便宜方案是最有参考价值的锚点
  const priced = offers
    .map((offer) => {
      const raw = Number(offer.price?.grandTotal ?? offer.price?.total ?? NaN);

      return { offer, raw };
    })
    .filter((item) => Number.isFinite(item.raw) && item.raw > 0)
    .sort((a, b) => a.raw - b.raw);

  if (priced.length === 0) {
    warnings.push("机票报价缺少有效价格字段，已改用估算");

    return { quote: null, warnings };
  }

  const best = priced[0];
  const itineraries = best.offer.itineraries ?? [];

  const outbound = toFlightLegs(itineraries[0]);
  const inbound = toFlightLegs(itineraries[1]);

  if (outbound.length === 0) {
    warnings.push("机票报价缺少去程航段信息，已改用估算");

    return { quote: null, warnings };
  }

  const total = toCny(best.raw);

  // Amadeus 的 total 是「按查询人数」的总价；换算单人价时需扣除儿童折扣影响
  const divisor = context.party.adults + context.party.children * CHILD_FLIGHT_RATIO;
  const pricePerAdult = divisor > 0 ? Math.round(total / divisor) : total;

  const stops = [...outbound, ...inbound].reduce(
    (sum, leg, index, all) => sum + (index > 0 && all[index - 1].to === leg.from ? 1 : 0),
    0,
  );

  const sandboxNote = config.sandbox
    ? "（Amadeus 测试环境，价格为示例数据，非真实可订价）"
    : "";

  return {
    quote: {
      ...makeQuoteMeta(
        "live",
        "amadeus",
        `Amadeus 实时询价，取最低价方案${sandboxNote}，实际以出票时价格为准`,
      ),
      pricePerAdult,
      totalPrice: totalFlightPrice(pricePerAdult, context.party),
      currency: "CNY",
      outbound,
      inbound,
      totalDurationMinutes: legsDurationMinutes([...outbound, ...inbound]),
      stops,
    },
    warnings,
  };
}

// ============================================================
// 酒店
// ============================================================

interface AmadeusHotelOffer {
  hotel?: { hotelId?: string; name?: string; rating?: string; cityCode?: string };
  offers?: Array<{
    price?: { total?: string; currency?: string };
    room?: { typeEstimated?: { category?: string } };
  }>;
}

/**
 * 查询住宿报价。
 *
 * 现实约束：Amadeus 的酒店报价覆盖度有限，很多城市只返回酒店清单而无房价。
 * 因此这里「能取到房价就用真实价格，取不到就返回 null 交由上层估算」，
 * 不做任何伪造。
 */
async function fetchHotelQuote(
  config: AmadeusConfig,
  context: QuoteContext,
): Promise<{ quote: HotelQuote | null; warnings: string[] }> {
  const warnings: string[] = [];

  if (context.nights <= 0) {
    return { quote: null, warnings };
  }

  const token = await getAccessToken(config);

  const params = new URLSearchParams({
    cityCode: context.destinationCode,
    checkInDate: context.departDate,
    checkOutDate: context.returnDate,
    adults: String(Math.max(1, context.party.adults)),
    roomQuantity: String(Math.max(1, context.rooms)),
    currency: "CNY",
    bestRateOnly: "true",
  });

  if (context.party.children > 0) {
    params.set("children", String(context.party.children));
  }

  const response = await fetchWithTimeout(
    `${config.host}/v3/shopping/hotel-offers?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    const text = await safeText(response);

    warnings.push(`住宿询价失败（HTTP ${response.status}），已改用估算：${text}`);

    return { quote: null, warnings };
  }

  const payload = (await response.json()) as { data?: AmadeusHotelOffer[] };
  const hotels = payload.data ?? [];

  if (hotels.length === 0) {
    warnings.push("住宿接口未返回该城市的房价数据，已改用估算");

    return { quote: null, warnings };
  }

  // 取总价最低的可订酒店
  const priced = hotels
    .map((hotel) => {
      const offer = hotel.offers?.[0];
      const raw = Number(offer?.price?.total ?? NaN);
      const rating = hotel.hotel?.rating ? Number(hotel.hotel.rating) : null;

      return { hotel, raw, rating };
    })
    .filter((item) => Number.isFinite(item.raw) && item.raw > 0)
    .sort((a, b) => a.raw - b.raw);

  if (priced.length === 0) {
    warnings.push("住宿接口返回了酒店清单但无可订房价（该接口在部分城市不提供价格），已改用估算");

    return { quote: null, warnings };
  }

  const best = priced[0];
  const total = Math.round(best.raw);
  const nights = Math.max(1, context.nights);

  const sandboxNote = config.sandbox
    ? "（Amadeus 测试环境，价格为示例数据，非真实可订价）"
    : "";

  return {
    quote: {
      ...makeQuoteMeta(
        "live",
        "amadeus",
        `Amadeus 实时房价，取最低价${best.hotel.hotel?.name ? `：${best.hotel.hotel.name}` : ""}${sandboxNote}`,
      ),
      name: best.hotel.hotel?.name ?? `${context.destinationCity}酒店`,
      rating: Number.isFinite(best.rating) ? best.rating : null,
      pricePerNight: Math.round(total / nights),
      totalPrice: total,
      currency: "CNY",
      rooms: Math.max(1, context.rooms),
      location: context.destinationCity,
    },
    warnings,
  };
}

// ============================================================
// Provider
// ============================================================

/**
 * 创建 Amadeus Provider。
 * 任一环节失败都只影响对应报价，另一项仍可返回真实数据。
 */
export function createAmadeusProvider(): QuoteProvider {
  return {
    name: "amadeus",

    supportsLiveQuotes() {
      return isAmadeusConfigured();
    },

    async fetchQuotes(context: QuoteContext): Promise<TravelQuotes> {
      const config = readConfig();

      if (!config) {
        throw new Error("Amadeus 凭据未配置");
      }

      const warnings: string[] = [];
      let flight: FlightQuote | null = null;
      let hotel: HotelQuote | null = null;

      // 两项询价互不依赖，并行发出以缩短总耗时
      const [flightResult, hotelResult] = await Promise.allSettled([
        fetchFlightQuote(config, context),
        fetchHotelQuote(config, context),
      ]);

      if (flightResult.status === "fulfilled") {
        flight = flightResult.value.quote;
        warnings.push(...flightResult.value.warnings);
      } else {
        warnings.push(`机票询价异常，已改用估算：${describeError(flightResult.reason)}`);
      }

      if (hotelResult.status === "fulfilled") {
        hotel = hotelResult.value.quote;
        warnings.push(...hotelResult.value.warnings);
      } else {
        warnings.push(`住宿询价异常，已改用估算：${describeError(hotelResult.reason)}`);
      }

      if (config.sandbox && (flight || hotel)) {
        warnings.push(
          "Amadeus 运行在测试环境：接口结构已跑通，但价格为示例数据，切换到生产环境后才是真实报价",
        );
      }

      return { flight, hotel, warnings };
    },
  };
}

/**
 * 统一错误描述，避免把 Error 对象直接塞进 warnings。
 *
 * 重点处理「fetch failed」这种无信息量的报错：Node 的 fetch 会把真正的
 * 原因放在 error.cause 里（ENOTFOUND / ECONNREFUSED / 超时等），只报
 * 顶层 message 的话，用户在页面上看到「fetch failed」完全无从下手。
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  // AbortError 说明是本模块主动超时
  if (error.name === "AbortError") {
    return `请求超时（超过 ${REQUEST_TIMEOUT_MS / 1000} 秒），目标接口可能被网络阻断`;
  }

  const cause = error.cause as { code?: string; message?: string } | undefined;
  const code = cause?.code;

  if (code) {
    const hints: Record<string, string> = {
      ENOTFOUND: "域名解析失败，请检查本机 DNS 或网络是否能访问 Amadeus",
      EAI_AGAIN: "DNS 暂时不可用，请稍后重试",
      ECONNREFUSED: "连接被拒绝，可能被防火墙或代理拦截",
      ECONNRESET: "连接被重置，可能被网络中间设备中断",
      ETIMEDOUT: "连接超时，网络到 Amadeus 不通",
      CERT_HAS_EXPIRED: "TLS 证书校验失败，可能被中间人代理拦截",
      UNABLE_TO_VERIFY_LEAF_SIGNATURE: "TLS 证书无法验证，可能处于企业代理环境",
    };

    return `${hints[code] ?? "网络请求失败"}（${code}）`;
  }

  // 没有 cause 时退回原始信息，至少保留 Amadeus 返回的业务错误
  return error.message;
}
