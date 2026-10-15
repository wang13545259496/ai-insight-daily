/**
 * RollingGo 报价 Provider。
 *
 * 职责：把 RollingGo 的实时酒店报价接入项目的报价链，
 * 并实现完整的降级——接口不可用时退回估算，不阻断行程生成。
 *
 * 与既有 Provider 的关系：
 *   createEstimateProvider  —— 纯估算（无外部依赖）
 *   createAmadeusProvider   —— Amadeus 实时报价（机票 + 酒店）
 *   createRollingGoProvider —— 本文件：RollingGo 实时酒店报价
 *
 * 当前只做酒店：RollingGo 的机票端点在服务端不存在（实测 404），
 * 因此机票部分仍走距离估算（见 fareEstimate.ts）。
 */

import { getStylePreset } from "./budget";
import { estimateFlightQuote, estimateHotelQuote, makeQuoteMeta } from "./providers";
import type { QuoteContext, QuoteProvider } from "./providers";
import { isRollingGoConfigured, searchHotels } from "./rollinggo";
import type { RollingGoHotel } from "./rollinggo";
import type { HotelQuote, TravelQuotes } from "./types";

/**
 * 按档位确定酒店星级筛选范围与排序偏好。
 *
 * 依据 budget.ts 的档位定义：
 *   budget   经济型 → 快捷酒店或青旅，选最便宜的
 *   comfort  舒适型 → 三至四星
 *   premium  品质型 → 四至五星
 *   luxury   奢华型 → 五星为主
 */
const STYLE_HOTEL_RULES: Record<
  string,
  { starRatings: [number, number]; note: string }
> = {
  budget: { starRatings: [0, 3], note: "经济型住宿" },
  comfort: { starRatings: [3, 4], note: "三至四星酒店" },
  premium: { starRatings: [4, 5], note: "四至五星酒店" },
  luxury: { starRatings: [4.5, 5], note: "五星酒店" },
};

/**
 * 从候选酒店中挑选最合适的一家。
 *
 * 规则：优先选有报价的；同等条件下按档位偏好——
 *   budget 选最便宜的，其余档位选星级最高、价格最低的。
 *
 * 之所以不直接取接口返回的第一条：接口按相关度排序，
 * 未必符合用户的预算档位。
 */
export function pickHotel(
  hotels: RollingGoHotel[],
  style: string,
): RollingGoHotel | null {
  const priced = hotels.filter((h) => h.pricePerNight !== null && h.pricePerNight > 0);

  if (priced.length === 0) {
    // 全部无报价时，仍返回一家（至少能给出酒店名与地址）
    return hotels[0] ?? null;
  }

  if (style === "budget") {
    // 经济型：取最便宜
    return priced.reduce((a, b) =>
      (b.pricePerNight ?? Infinity) < (a.pricePerNight ?? Infinity) ? b : a,
    );
  }

  // 其余档位：星级优先，同星级取低价
  return priced.reduce((a, b) => {
    const sa = a.starRating;
    const sb = b.starRating;

    if (sb !== sa) return sb > sa ? b : a;

    return (b.pricePerNight ?? Infinity) < (a.pricePerNight ?? Infinity) ? b : a;
  });
}

/** 把 RollingGo 酒店转为项目的 HotelQuote */
export function toHotelQuote(
  hotel: RollingGoHotel,
  context: QuoteContext,
  ruleNote: string,
): HotelQuote {
  const rooms = Math.max(1, context.rooms);
  const nights = Math.max(0, context.nights);

  // 接口返回的 lowestPrice 是「每间每晚」价格
  const perRoomNight = hotel.pricePerNight ?? 0;
  const pricePerNight = Math.round(perRoomNight * rooms);

  const starText = hotel.starRating > 0 ? ` | ${hotel.starRating} 星` : "";

  return {
    ...makeQuoteMeta(
      "live",
      "rollinggo",
      `RollingGo 实时报价：${hotel.name}${starText}｜${ruleNote}｜` +
        `房源与价格以预订页为准${hotel.bookingUrl ? `（${hotel.bookingUrl}）` : ""}`,
    ),
    name: hotel.name,
    rating: hotel.starRating > 0 ? hotel.starRating : null,
    pricePerNight,
    totalPrice: pricePerNight * nights,
    currency: "CNY",
    rooms,
    location: hotel.address || context.destinationCity,
  };
}

/**
 * 创建 RollingGo Provider。
 *
 * fetchQuotes 的行为：
 *   · Key 未配置     → 完全回退估算（不发起任何网络请求）
 *   · 酒店查询成功   → 酒店用实时报价，机票用距离估算
 *   · 酒店查询失败   → 酒店回退估算，告警里说明原因
 */
export function createRollingGoProvider(): QuoteProvider {
  return {
    name: "rollinggo",

    supportsLiveQuotes: () => isRollingGoConfigured(),

    async fetchQuotes(context: QuoteContext): Promise<TravelQuotes> {
      const warnings: string[] = [];

      // 机票：RollingGo 的机票端点当前不可用，统一走距离估算
      const flight = estimateFlightQuote(context);

      if (!isRollingGoConfigured()) {
        warnings.push("未配置 ROLLINGGO_API_KEY，酒店价格按目的地档位估算");

        return {
          flight,
          hotel: context.nights > 0 ? estimateHotelQuote(context) : null,
          warnings,
        };
      }

      const rule = STYLE_HOTEL_RULES[context.style] ?? STYLE_HOTEL_RULES.comfort;
      const preset = getStylePreset(context.style);

      const result = await searchHotels({
        place: context.destinationCity,
        checkInDate: context.departDate,
        stayNights: Math.max(1, context.nights),
        adultCount: Math.max(1, Math.ceil((context.party.adults + context.party.children) / Math.max(1, context.rooms))),
        starRatings: rule.starRatings,
        size: 10,
      });

      if (result.error) {
        warnings.push(`RollingGo 酒店查询失败（${result.error}），已回退为估算`);
        warnings.push(`估算依据：${preset.label}档位，${preset.hotelGrade}`);

        return {
          flight,
          hotel: context.nights > 0 ? estimateHotelQuote(context) : null,
          warnings,
        };
      }

      const hotel = pickHotel(result.hotels, context.style);

      if (!hotel) {
        warnings.push("RollingGo 未返回符合条件的酒店，已回退为估算");

        return {
          flight,
          hotel: context.nights > 0 ? estimateHotelQuote(context) : null,
          warnings,
        };
      }

      if (hotel.pricePerNight === null) {
        warnings.push(`RollingGo 返回的「${hotel.name}」无实时价格，已回退为估算`);
      }

      warnings.push(
        `酒店为 RollingGo 实时报价（${result.hotels.length} 家候选中按「${rule.note}」筛选）；` +
          `机票为按航线距离估算`,
      );

      return {
        flight,
        hotel: context.nights > 0 ? toHotelQuote(hotel, context, rule.note) : null,
        warnings,
      };
    },
  };
}
