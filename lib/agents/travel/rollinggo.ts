/**
 * RollingGo 酒店 MCP 客户端。
 *
 * 服务说明（https://github.com/RollingGo-AI/rollinggo-hotel-mcp）：
 *   200 万+ 酒店，库存直连与实时价格确认，查询结果可直接预订。
 *   协议是 MCP（JSON-RPC over HTTP），不是传统 REST。
 *
 * 端点实测（2026-10）：
 *   酒店 https://mcp.rollinggo.cn/mcp        → HTTP 200，3 个工具
 *   机票 https://mcp.rollinggo.cn/mcp/flight → HTTP 404
 *   README 虽列出机票端点，但当前服务端不存在该路径
 *   （探测过 /flight /flights /air /airline /ticket 等 8 个候选，均不可用），
 *   因此本模块只实现酒店。
 *
 * 返回结构（实测）：
 *   { success, code, message, hotelInformationList: [{ hotelId, name, brand,
 *     address, latitude, longitude, starRating, price: { hasPrice, currency,
 *     lowestPrice, message }, bookingUrl, hotelAmenities, description }] }
 *
 * 设计要点：未配置 Key 时不发任何请求 —— 报价接口是按次计费的商务资源，
 * 与 lib/agents/travel/amadeus.ts 的处理保持一致。
 */

/** MCP 端点 */
const MCP_URL = "https://mcp.rollinggo.cn/mcp";

/** 单次请求超时（毫秒）。实测上海查询耗时约 2.6 秒，30 秒留足余量 */
const REQUEST_TIMEOUT_MS = 30_000;

/** 是否已配置 Key */
export function isRollingGoConfigured(): boolean {
  return Boolean(process.env.ROLLINGGO_API_KEY?.trim());
}

/** 单家酒店（已归一化，只保留本项目需要的字段） */
export interface RollingGoHotel {
  hotelId: number;
  name: string;
  brand: string;
  address: string;
  starRating: number;
  /** 每晚价格（人民币）；hasPrice 为 false 时为 null */
  pricePerNight: number | null;
  currency: string;
  /** 可预订链接 */
  bookingUrl: string;
  latitude: number | null;
  longitude: number | null;
  /** 设施标签（截取前若干个，避免传输过大） */
  amenities: string[];
}

/** 搜索参数 */
export interface RollingGoSearchParams {
  /** 目的地城市名（如「上海」） */
  place: string;
  /** 入住日期 YYYY-MM-DD */
  checkInDate: string;
  /** 住几晚 */
  stayNights: number;
  /** 每间房成人数 */
  adultCount?: number;
  /** 星级范围 [最低, 最高] */
  starRatings?: [number, number];
  /** 每晚价格上限 */
  maxPricePerNight?: number;
  /** 返回条数，最大 20 */
  size?: number;
}

/** 搜索结果 */
export interface RollingGoSearchResult {
  hotels: RollingGoHotel[];
  /** 接口是否报错（用于上层决定是否回退） */
  error: string | null;
}

/** 从 MCP 响应中取出文本块并解析为 JSON */
function parseMcpPayload(raw: string): unknown {
  // MCP 可能以 SSE 形式返回（data: 行），也可能直接返回 JSON
  const dataLines = raw
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim());

  const payloadText = dataLines.length > 0 ? dataLines.join("") : raw;

  let envelope: unknown;

  try {
    envelope = JSON.parse(payloadText);
  } catch {
    return null;
  }

  const obj = envelope as {
    error?: { message?: string };
    result?: { content?: Array<{ type?: string; text?: string }> };
  };

  if (obj?.error) {
    return { __error: obj.error.message || "MCP 返回 error" };
  }

  const content = obj?.result?.content;

  if (!Array.isArray(content)) return null;

  const textBlock = content.find((c) => c?.type === "text" && typeof c.text === "string");

  if (!textBlock?.text) return null;

  try {
    return JSON.parse(textBlock.text);
  } catch {
    return null;
  }
}

/** 把接口返回的单条记录归一化 */
function normalizeHotel(raw: Record<string, unknown>): RollingGoHotel | null {
  const id = Number(raw.hotelId);

  if (!Number.isFinite(id)) return null;

  const price = (raw.price ?? {}) as Record<string, unknown>;
  const hasPrice = price.hasPrice === true;
  const lowest = Number(price.lowestPrice);

  const amenities = Array.isArray(raw.hotelAmenities)
    ? raw.hotelAmenities.filter((a) => typeof a === "string").slice(0, 12) as string[]
    : [];

  return {
    hotelId: id,
    name: String(raw.name || raw.nameEn || "未知酒店"),
    brand: String(raw.brand || ""),
    address: String(raw.address || ""),
    starRating: Number(raw.starRating) || 0,
    pricePerNight: hasPrice && Number.isFinite(lowest) ? lowest : null,
    currency: String(price.currency || "CNY"),
    bookingUrl: String(raw.bookingUrl || ""),
    latitude: Number.isFinite(Number(raw.latitude)) ? Number(raw.latitude) : null,
    longitude: Number.isFinite(Number(raw.longitude)) ? Number(raw.longitude) : null,
    amenities,
  };
}

/**
 * 搜索酒店。
 *
 * 失败一律返回 { hotels: [], error }，不抛异常 ——
 * 调用方据此决定是否回退到估算，与项目既有的降级策略一致。
 */
export async function searchHotels(
  params: RollingGoSearchParams,
): Promise<RollingGoSearchResult> {
  const key = process.env.ROLLINGGO_API_KEY?.trim();

  if (!key) {
    return { hotels: [], error: "未配置 ROLLINGGO_API_KEY" };
  }

  const checkInParam: Record<string, unknown> = {
    checkInDate: params.checkInDate,
    stayNights: Math.max(1, Math.min(28, Math.round(params.stayNights))),
  };

  if (params.adultCount) {
    checkInParam.adultCount = params.adultCount;
  }

  const filterOptions: Record<string, unknown> = {};

  if (params.starRatings) {
    filterOptions.starRatings = params.starRatings;
  }

  const hotelTags: Record<string, unknown> = {};

  if (params.maxPricePerNight) {
    hotelTags.maxPricePerNight = params.maxPricePerNight;
  }

  const body = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "searchHotels",
      arguments: {
        originQuery: `${params.place}酒店`,
        place: params.place,
        placeType: "城市",
        checkInParam,
        ...(Object.keys(filterOptions).length > 0 ? { filterOptions } : {}),
        ...(Object.keys(hotelTags).length > 0 ? { hotelTags } : {}),
        size: Math.max(1, Math.min(20, params.size ?? 10)),
      },
    },
    id: 1,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { hotels: [], error: `RollingGo 返回 HTTP ${res.status}` };
    }

    const parsed = parseMcpPayload(await res.text());

    if (!parsed) {
      return { hotels: [], error: "RollingGo 响应无法解析" };
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.__error === "string") {
      return { hotels: [], error: `RollingGo 接口报错：${obj.__error}` };
    }

    if (obj.success !== true) {
      return { hotels: [], error: `RollingGo 返回失败：${String(obj.message || obj.code || "未知")}` };
    }

    const list = Array.isArray(obj.hotelInformationList) ? obj.hotelInformationList : [];

    const hotels = list
      .map((item) => normalizeHotel(item as Record<string, unknown>))
      .filter((h): h is RollingGoHotel => h !== null);

    return { hotels, error: null };
  } catch (e) {
    const msg = String(e);

    return {
      hotels: [],
      error: msg.includes("abort") ? "RollingGo 请求超时" : `RollingGo 请求异常：${msg.slice(0, 80)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// 房型明细（getHotelDetail）
// ============================================================

/** 一个房型报价（已归一化） */
export interface RoomOption {
  /** 房型名 */
  roomName: string;
  /** 每晚均价（元） */
  averagePrice: number;
  /** 床型描述，如「1 大床」 */
  bedType: string;
  /** 早餐说明，如「含早餐」 */
  meal: string;
  /** 退改政策说明 */
  cancelPolicy: string;
  /** 是否可免费取消 */
  cancelable: boolean;
  /** 房间面积（平方米，字符串因为接口会给「12–16」这类区间） */
  size: string;
  /** 最大入住人数 */
  maxOccupancy: number | null;
}

/** 房型查询结果 */
export interface HotelDetailResult {
  rooms: RoomOption[];
  error: string | null;
}

/** 把接口返回的房型归一化 */
function normalizeRoom(raw: Record<string, unknown>): RoomOption | null {
  const price = Number(raw.averagePrice);

  if (!Number.isFinite(price) || price <= 0) return null;

  const roomInfo =
    raw.roomInfo && typeof raw.roomInfo === "object" && !Array.isArray(raw.roomInfo)
      ? (raw.roomInfo as Record<string, unknown>)
      : {};

  const maxOcc = Number(roomInfo.maxOccupancy);

  return {
    roomName: String(raw.roomName || raw.ratePlanName || "未知房型"),
    averagePrice: price,
    bedType: String(raw.bedTypeDescription || ""),
    meal: String(raw.mealTypeStr || ""),
    cancelPolicy: String(raw.cancelPolicy || ""),
    cancelable: raw.cancelable === true,
    size: String(roomInfo.size || ""),
    maxOccupancy: Number.isFinite(maxOcc) && maxOcc > 0 ? maxOcc : null,
  };
}

/**
 * 查询单个酒店的实时房型与价格明细。
 *
 * 用途：搜索结果只给「最低价」，用户决定预订前通常想知道
 * 有哪些房型、是否含早、能否免费取消 —— 这些只有本接口提供。
 *
 * @param limit 最多返回几个房型（按价格升序），默认 6
 */
export async function fetchHotelDetail(
  hotelId: number,
  checkInDate: string,
  checkOutDate: string,
  adultCount = 2,
  limit = 6,
): Promise<HotelDetailResult> {
  const key = process.env.ROLLINGGO_API_KEY?.trim();

  if (!key) {
    return { rooms: [], error: "未配置 ROLLINGGO_API_KEY" };
  }

  if (!Number.isFinite(hotelId) || hotelId <= 0) {
    return { rooms: [], error: "酒店 ID 无效" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "getHotelDetail",
          arguments: {
            hotelId,
            dateParam: { checkInDate, checkOutDate },
            occupancyParam: { adultCount },
          },
        },
        id: 1,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { rooms: [], error: `房型查询返回 HTTP ${res.status}` };
    }

    const parsed = parseMcpPayload(await res.text());

    if (!parsed) {
      return { rooms: [], error: "房型响应无法解析" };
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.__error === "string") {
      return { rooms: [], error: `房型接口报错：${obj.__error}` };
    }

    /**
     * 实测返回结构（与参数 schema 的推测不同）：
     *   { success, hotelId, bookingUrl, name, starRating, checkIn, checkOut,
     *     roomRatePlans: [...], code, message }
     * 房型数组在**顶层**的 roomRatePlans，不在 data.roomList 里。
     * 这里仍保留 data 嵌套形态的兼容，以防服务端后续调整。
     */
    const data =
      obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
        ? (obj.data as Record<string, unknown>)
        : {};

    const list = Array.isArray(obj.roomRatePlans)
      ? obj.roomRatePlans
      : Array.isArray(data.roomRatePlans)
        ? data.roomRatePlans
        : Array.isArray(data.roomList)
          ? data.roomList
          : [];

    const rooms = list
      .map((r) => normalizeRoom(r as Record<string, unknown>))
      .filter((r): r is RoomOption => r !== null)
      .sort((a, b) => a.averagePrice - b.averagePrice)
      .slice(0, Math.max(1, limit));

    return { rooms, error: null };
  } catch (e) {
    const msg = String(e);

    return {
      rooms: [],
      error: msg.includes("abort") ? "房型查询超时" : `房型查询异常：${msg.slice(0, 80)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
