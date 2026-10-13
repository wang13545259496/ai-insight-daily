/**
 * 报价数据源（Provider）抽象层。
 *
 * 为什么要有抽象层：
 * 机票/酒店的实时报价属于强商务资源，供应商会换（Amadeus、携程、
 * 自建网关），而行程编排逻辑不应该跟着改。这里把「取价」收敛成
 * 一个接口，上层只认 TravelQuotes。
 *
 * 降级策略：未配置凭据、接口报错、城市不在覆盖范围时，一律返回
 * confidence="estimate" 的估算报价，并在 warnings 里说明原因，
 * 保证功能可用且不会把估算值伪装成真实价格。
 */

import { getStylePreset } from "./budget";
import type {
  FlightLeg,
  FlightQuote,
  HotelQuote,
  QuoteMeta,
  TravelParty,
  TravelQuotes,
  TravelStyle,
} from "./types";

/** 询价上下文：已归一化的行程参数 */
export interface QuoteContext {
  originCity: string;
  destinationCity: string;
  originCode: string;
  destinationCode: string;
  departDate: string;
  returnDate: string;
  nights: number;
  party: TravelParty;
  style: TravelStyle;
  /** 需要预订的房间数 */
  rooms: number;
  /** 是否旺季 */
  peakSeason: boolean;
}

/** 询价接口 */
export interface QuoteProvider {
  name: string;
  /** 是否具备真实询价能力（凭据齐全） */
  supportsLiveQuotes(): boolean;
  fetchQuotes(context: QuoteContext): Promise<TravelQuotes>;
}

/** 统一构造报价元信息，避免各处手写 fetchedAt */
export function makeQuoteMeta(
  confidence: QuoteMeta["confidence"],
  provider: string,
  note: string,
): QuoteMeta {
  return {
    confidence,
    provider,
    note,
    fetchedAt: new Date().toISOString(),
  };
}

/** 空报价结果 */
export function emptyQuotes(warnings: string[] = []): TravelQuotes {
  return { flight: null, hotel: null, warnings };
}

/** 把分钟数格式化为「8小时30分」 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}分`;
  }

  return mins === 0 ? `${hours}小时` : `${hours}小时${mins}分`;
}

/** 汇总一组航段的飞行时间（分钟），忽略转机停留 */
export function legsDurationMinutes(legs: FlightLeg[]): number {
  return legs.reduce((sum, leg) => {
    const start = Date.parse(leg.departAt);
    const end = Date.parse(leg.arriveAt);

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return sum;
    }

    return sum + Math.round((end - start) / 60000);
  }, 0);
}

/**
 * 儿童票价系数：按国内航司惯例约成人 75 折。
 * 住宿按加床处理，不额外计房费；门票由景区政策决定，不计入此系数。
 */
export const CHILD_FLIGHT_RATIO = 0.75;

/** 按人数折算机票总价 */
export function totalFlightPrice(pricePerAdult: number, party: TravelParty): number {
  return Math.round(pricePerAdult * party.adults + pricePerAdult * CHILD_FLIGHT_RATIO * party.children);
}

/**
 * 由人数推算房间数。
 * 惯例：2 人 1 间，儿童与成人同住，每间最多 3 人（含加床）。
 */
export function resolveRoomCount(party: TravelParty): number {
  const headcount = party.adults + party.children;

  if (headcount <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(headcount / 3));
}

/** 快捷酒店/民宿的基准价（元/间/晚），旺季另行上浮 */
export function hotelBaselinePerRoomNight(style: TravelStyle): number {
  return getStylePreset(style).hotelFloorPerRoomNight;
}

/** 估算住宿：拿不到报价时，用档位基准价 × 旺季系数生成 */
export function estimateHotelQuote(context: QuoteContext): HotelQuote {
  const seasonFactor = context.peakSeason ? 1.35 : 1;
  const nightly = Math.round(hotelBaselinePerRoomNight(context.style) * seasonFactor);
  const preset = getStylePreset(context.style);

  return {
    ...makeQuoteMeta(
      "estimate",
      "heuristic",
      "未取得实时房价，按目的地档位基准价估算，实际以预订平台为准",
    ),
    name: `${context.destinationCity}${preset.hotelGrade}（预估）`,
    rating: null,
    pricePerNight: nightly * Math.max(1, context.rooms),
    totalPrice: nightly * Math.max(1, context.rooms) * Math.max(0, context.nights),
    currency: "CNY",
    rooms: Math.max(1, context.rooms),
    location: context.destinationCity,
  };
}

/**
 * 估算机票：拿不到报价时，按「档位人均价 × 人数」生成，
 * 并明确标注为估算，避免用户误以为是可下单价格。
 */
export function estimateFlightQuote(context: QuoteContext): FlightQuote {
  const preset = getStylePreset(context.style);
  const seasonFactor = context.peakSeason ? 1.3 : 1;

  // 把档位换算成人均往返机票基准（与 budget.ts 的兜底值保持同一量纲）
  const perAdultBase: Record<TravelStyle, number> = {
    budget: 400,
    comfort: 700,
    premium: 1300,
    luxury: 2400,
  };

  const pricePerAdult = Math.round(perAdultBase[context.style] * seasonFactor);
  const total = totalFlightPrice(pricePerAdult, context.party);

  return {
    ...makeQuoteMeta(
      "estimate",
      "heuristic",
      `未取得实时机票报价，按${preset.label}往返人均 ${pricePerAdult} 元估算，实际以航司或购票平台为准`,
    ),
    pricePerAdult,
    totalPrice: total,
    currency: "CNY",
    outbound: [
      {
        from: context.originCode,
        to: context.destinationCode,
        departAt: `${context.departDate}T08:00:00`,
        arriveAt: `${context.departDate}T10:30:00`,
        carrier: "EST",
        flightNumber: "EST-1",
      },
    ],
    inbound: [
      {
        from: context.destinationCode,
        to: context.originCode,
        departAt: `${context.returnDate}T19:00:00`,
        arriveAt: `${context.returnDate}T21:30:00`,
        carrier: "EST",
        flightNumber: "EST-2",
      },
    ],
    totalDurationMinutes: 300,
    stops: 0,
  };
}

/**
 * 无凭据 / 真实询价失败时的兜底 Provider。
 * 它的价值在于：让「没有 API Key」不等于「功能不可用」。
 */
export function createEstimateProvider(warnings: string[] = []): QuoteProvider {
  return {
    name: "heuristic",
    supportsLiveQuotes: () => false,
    async fetchQuotes(context: QuoteContext): Promise<TravelQuotes> {
      return {
        flight: estimateFlightQuote(context),
        hotel: context.nights > 0 ? estimateHotelQuote(context) : null,
        warnings: [...warnings, "当前为估算模式：未接入实时报价接口，价格仅供参考"],
      };
    },
  };
}
