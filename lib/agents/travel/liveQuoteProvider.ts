/**
 * 实时报价 Provider：飞常准（机票）+ RollingGo（酒店）。
 *
 * 为什么合并为一个 Provider：项目的报价链是「选一个 Provider，它返回机票
 * 与酒店两项」。而现实是机票与酒店的最佳数据源不同——
 *   · 机票：飞常准（国内覆盖 99.99%，票价含全部国内航司与舱位）
 *   · 酒店：RollingGo（200 万+ 酒店，库存直连）
 * 因此用一个 Provider 组合两者，任一失败即回退到对应的估算。
 *
 * 降级矩阵（每一项独立降级，互不影响）：
 *   机票：飞常准实时 → 距离估算
 *   酒店：RollingGo 实时 → 档位估算
 *
 * 费用提示：飞常准按次计费（5-50 credits/次，1 credit = ¥0.01），
 * 因此未配置 Key 时不发请求；且只查一次票价（取最低价），不做逐航班比价。
 */

import { getStylePreset } from "./budget";
import { describeFareBasis, estimatePerAdultFare, routeDistance } from "./fareEstimate";
import { estimateFlightQuote, estimateHotelQuote, makeQuoteMeta } from "./providers";
import type { QuoteContext, QuoteProvider } from "./providers";
import { isRollingGoConfigured, searchHotels } from "./rollinggo";
import type { RollingGoHotel } from "./rollinggo";
import { fetchFlightPrices, isVariflightConfigured, lowestPrice } from "./variflight";
import type { VariflightFlight } from "./variflight";
import type { FlightLeg, FlightQuote, HotelQuote, TravelQuotes, TravelStyle } from "./types";

/** 按档位映射舱位（用于飞常准查价与距离估算） */
const CABIN_BY_STYLE: Record<TravelStyle, "economy" | "premium" | "business"> = {
  budget: "economy",
  comfort: "economy",
  premium: "premium",
  luxury: "business",
};

/** 飞常准的舱位中文关键词 */
const CABIN_KEYWORD_BY_STYLE: Record<TravelStyle, string> = {
  budget: "经济",
  comfort: "经济",
  premium: "经济",
  luxury: "公务",
};

/** 按档位确定酒店星级范围 */
const STYLE_HOTEL_RULES: Record<TravelStyle, { starRatings: [number, number]; note: string }> = {
  budget: { starRatings: [0, 3], note: "经济型住宿" },
  comfort: { starRatings: [3, 4], note: "三至四星酒店" },
  premium: { starRatings: [4, 5], note: "四至五星酒店" },
  luxury: { starRatings: [4.5, 5], note: "五星酒店" },
};

/**
 * 从候选酒店中挑选最合适的一家。
 *
 * 规则：优先选有报价的；经济型取最便宜，
 * 其余档位星级优先、同星级取低价。
 */
export function pickHotel(hotels: RollingGoHotel[], style: string): RollingGoHotel | null {
  const priced = hotels.filter((h) => h.pricePerNight !== null && h.pricePerNight > 0);

  if (priced.length === 0) {
    return hotels[0] ?? null;
  }

  if (style === "budget") {
    return priced.reduce((a, b) =>
      (b.pricePerNight ?? Infinity) < (a.pricePerNight ?? Infinity) ? b : a,
    );
  }

  return priced.reduce((a, b) => {
    if (b.starRating !== a.starRating) return b.starRating > a.starRating ? b : a;

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

  const pricePerNight = Math.round((hotel.pricePerNight ?? 0) * rooms);
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
 * 把毫秒时间戳格式化为北京时间字符串（YYYY-MM-DDTHH:mm:ss）。
 *
 * 为什么不能用 toISOString()：它输出 UTC，而飞常准返回的时间戳是
 * 北京时间对应的时刻。实测踩过的坑 —— 北京时间 20:45 起飞的航班，
 * 用 toISOString() 得到 12:45，与来源说明里的 20:45 自相矛盾。
 * 项目其它地方统一用 Asia/Shanghai（见 app/page.tsx 的 formatDate）。
 */
function toBeijingIso(ms: number): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms));

  // sv-SE 的输出形如 "2026-10-29 20:45:00"，换成 ISO 的 T 分隔
  return parts.replace(" ", "T");
}

/** 由飞常准航班构造民航航段 */
function toLegs(flight: VariflightFlight, context: QuoteContext, fallbackFrom: string, fallbackTo: string): FlightLeg[] {
  const from = flight.depCode || fallbackFrom;
  const to = flight.arrCode || fallbackTo;

  const departAt = flight.departAt
    ? toBeijingIso(flight.departAt)
    : `${context.departDate}T08:00:00`;

  const arriveAt = flight.arriveAt
    ? toBeijingIso(flight.arriveAt)
    : `${context.departDate}T10:30:00`;

  return [
    {
      from,
      to,
      departAt,
      arriveAt,
      carrier: flight.airline || "未知",
      flightNumber: flight.flightNumber,
    },
  ];
}

/**
 * 由飞常准报价构造 FlightQuote。
 *
 * 价格口径：接口返回的是**单程单人**价格，
 * 因此往返需按 2 倍单程计（不做「往返票折扣」的假设——
 * 真实往返价需要单独查询返程，会多消耗一次额度）。
 */
export function toFlightQuote(
  flight: VariflightFlight,
  pricePerOneWay: number,
  context: QuoteContext,
): FlightQuote {
  const perAdult = pricePerOneWay * 2; // 往返 = 两段单程

  const total = Math.round(
    perAdult * context.party.adults + perAdult * 0.75 * context.party.children,
  );

  const depTime = flight.departAt
    ? new Date(flight.departAt).toLocaleTimeString("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";

  return {
    ...makeQuoteMeta(
      "live",
      "variflight",
      `飞常准实时票价：${flight.flightNumber} ${flight.depAirport}→${flight.arrAirport}` +
        `${depTime ? ` ${depTime} 起飞` : ""}｜单程 ¥${pricePerOneWay}，往返人均 ¥${perAdult}｜` +
        `价格随舱位余量实时变动，以航司或购票平台为准`,
    ),
    pricePerAdult: perAdult,
    totalPrice: total,
    currency: "CNY",
    outbound: toLegs(flight, context, context.originCode, context.destinationCode),
    inbound: [
      {
        from: context.destinationCode,
        to: context.originCode,
        departAt: `${context.returnDate}T19:00:00`,
        arriveAt: `${context.returnDate}T21:30:00`,
        carrier: flight.airline || "未知",
        flightNumber: `${flight.flightNumber}（返程待定）`,
      },
    ],
    totalDurationMinutes: 300,
    stops: flight.hasStop ? 1 : 0,
  };
}

/** 距离估算的机票（回退用），逻辑与 estimateFlightQuote 一致 */
function fallbackFlight(context: QuoteContext): { quote: FlightQuote; reason: string } {
  const quote = estimateFlightQuote(context);
  const distance = routeDistance(context.originCode, context.destinationCode);

  const reason =
    distance !== null && distance > 0
      ? `距离估算（${describeFareBasis(
          {
            distanceKm: distance,
            roundTrip: true,
            cabin: CABIN_BY_STYLE[context.style],
            peakSeason: context.peakSeason,
            daysUntilDeparture: null,
          },
          quote.pricePerAdult,
        )}）`
      : "距离估算（航线距离未知，按档位基准价）";

  return { quote, reason };
}

/**
 * 创建组合 Provider。
 */
export function createLiveQuoteProvider(): QuoteProvider {
  return {
    name: "variflight+rollinggo",

    supportsLiveQuotes: () => isVariflightConfigured() || isRollingGoConfigured(),

    async fetchQuotes(context: QuoteContext): Promise<TravelQuotes> {
      const warnings: string[] = [];

      // ---------- 机票：飞常准 ----------
      let flight: FlightQuote | null = null;

      if (isVariflightConfigured()) {
        const result = await fetchFlightPrices(
          context.originCode || context.originCity,
          context.destinationCode || context.destinationCity,
          context.departDate,
        );

        if (result.error) {
          const fb = fallbackFlight(context);
          flight = fb.quote;
          warnings.push(`飞常准机票查询失败（${result.error}），已回退为${fb.reason}`);
        } else {
          const best = lowestPrice(result.flights, CABIN_KEYWORD_BY_STYLE[context.style]);

          if (!best) {
            const fb = fallbackFlight(context);
            flight = fb.quote;
            warnings.push(
              `飞常准返回 ${result.flights.length} 个航班但无可用报价，已回退为${fb.reason}`,
            );
          } else {
            flight = toFlightQuote(best.flight, best.price, context);
            warnings.push(
              `机票为飞常准实时票价（${result.flights.length} 个航班中取最低），` +
                `舱位「${CABIN_KEYWORD_BY_STYLE[context.style]}」`,
            );
          }
        }
      } else {
        const fb = fallbackFlight(context);
        flight = fb.quote;
        warnings.push(`未配置 VARIFLIGHT_API_KEY，机票为${fb.reason}`);
      }

      // ---------- 酒店：RollingGo ----------
      let hotel: HotelQuote | null = null;

      if (context.nights <= 0) {
        return { flight, hotel: null, warnings };
      }

      const rule = STYLE_HOTEL_RULES[context.style] ?? STYLE_HOTEL_RULES.comfort;
      const preset = getStylePreset(context.style);

      if (!isRollingGoConfigured()) {
        hotel = estimateHotelQuote(context);
        warnings.push("未配置 ROLLINGGO_API_KEY，酒店价格按目的地档位估算");

        return { flight, hotel, warnings };
      }

      const headcount = context.party.adults + context.party.children;
      const result = await searchHotels({
        place: context.destinationCity,
        checkInDate: context.departDate,
        stayNights: Math.max(1, context.nights),
        adultCount: Math.max(1, Math.ceil(headcount / Math.max(1, context.rooms))),
        starRatings: rule.starRatings,
        size: 10,
      });

      if (result.error) {
        hotel = estimateHotelQuote(context);
        warnings.push(
          `RollingGo 酒店查询失败（${result.error}），已回退为估算（${preset.label}档位，${preset.hotelGrade}）`,
        );

        return { flight, hotel, warnings };
      }

      const picked = pickHotel(result.hotels, context.style);

      if (!picked) {
        hotel = estimateHotelQuote(context);
        warnings.push("RollingGo 未返回符合条件的酒店，已回退为估算");

        return { flight, hotel, warnings };
      }

      hotel = toHotelQuote(picked, context, rule.note);
      warnings.push(
        `酒店为 RollingGo 实时报价（${result.hotels.length} 家候选中按「${rule.note}」筛选）`,
      );

      return { flight, hotel, warnings };
    },
  };
}
