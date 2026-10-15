/**
 * 飞常准（Variflight）Aviation MCP 客户端。
 *
 * 服务说明（https://ai.variflight.com）：
 *   国内航班覆盖 99.99%，国际约 97%；票价覆盖全部国内航司与舱位。
 *   协议为 MCP（JSON-RPC over HTTP），鉴权用 X-API-Key 头。
 *
 * 计费（官方说明）：
 *   5-50 credits/次（1 credit = ¥0.01，即 ¥0.05-0.5/次）；
 *   initialize / tools/list / getTodayDate 免费；失败的调用不计费。
 *   因此本模块严格遵守「未配置 Key 时不发请求」。
 *
 * 返回格式的坑：getFlightPriceByCities 返回的**不是 JSON**，而是形如
 *   Flight prices: {'code': 200, 'message': 'Success', 'data': [{...}]}
 * 的 Python dict 字符串（单引号、无引号键），需要先转换再解析。
 */

/** 端点 */
const AVIATION_MCP_URL = "https://ai.variflight.com/servers/aviation/mcp";

/** 单次请求超时（毫秒）。实测北京→上海耗时约 0.5 秒，20 秒留足余量 */
const REQUEST_TIMEOUT_MS = 20_000;

/** 是否已配置 Key */
export function isVariflightConfigured(): boolean {
  return Boolean(process.env.VARIFLIGHT_API_KEY?.trim());
}

/** 一个航班的某个舱位报价 */
export interface VariflightCabin {
  /** 舱位等级（Y 经济 / C 公务 / F 头等） */
  cabinClass: string;
  /** 中文舱位名 */
  className: string;
  /** 舱位代码 */
  cabinCode: string;
  /** 折扣（0.26 表示 2.6 折） */
  discount: number | null;
  /** 折扣后价格（元） */
  price: number;
  /** 全价（元） */
  standardPrice: number | null;
  /** 剩余座位 */
  seats: number | null;
}

/** 一个航班（已归一化） */
export interface VariflightFlight {
  /** 航班号，如 MU5160 */
  flightNumber: string;
  /** 航司二字码，如 MU */
  airline: string;
  /** 出发机场中文名 */
  depAirport: string;
  /** 到达机场中文名 */
  arrAirport: string;
  /** 出发三字码 */
  depCode: string;
  /** 到达三字码 */
  arrCode: string;
  /** 计划起飞时间（毫秒时间戳） */
  departAt: number | null;
  /** 计划到达时间 */
  arriveAt: number | null;
  /** 航程距离（公里） */
  distance: number | null;
  /** 是否经停 */
  hasStop: boolean;
  /** 各舱位报价 */
  cabins: VariflightCabin[];
}

/** 查询结果 */
export interface VariflightPriceResult {
  flights: VariflightFlight[];
  error: string | null;
}

/**
 * 把 Python dict 字面量转为标准 JSON 文本。
 *
 * 需要处理的差异：
 *   · 单引号字符串（且字符串内可能含双引号或撇号）
 *   · 未加引号的键
 *   · True / False / None
 *   · 前缀说明文字（如 "Flight prices: "）
 *
 * 逐字符扫描而不是正则整体替换 —— 正则无法可靠区分
 * 「字符串的结束引号」与「字符串内部的同类引号」。
 */
export function pythonDictToJson(input: string): string {
  let s = String(input ?? "").trim();

  // 去掉前缀说明
  const firstBrace = s.indexOf("{");

  if (firstBrace > 0) s = s.slice(firstBrace);

  // 截到最后一个右花括号（去掉尾随说明）
  const lastBrace = s.lastIndexOf("}");

  if (lastBrace !== -1) s = s.slice(0, lastBrace + 1);

  // 字面量
  s = s.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");

  // 引号转换
  let out = "";
  let inString = false;
  let quoteChar = "";

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (!inString) {
      if (ch === "'" || ch === '"') {
        inString = true;
        quoteChar = ch;
        out += '"';
      } else {
        out += ch;
      }

      continue;
    }

    // 字符串内部
    if (ch === "\\") {
      const next = s[i + 1];

      if (next === quoteChar) {
        // 转义引号 → 保留为字面引号
        out += quoteChar === "'" ? "'" : '\\"';
        i++;
      } else if (next) {
        out += "\\" + next;
        i++;
      }

      continue;
    }

    if (ch === quoteChar) {
      inString = false;
      out += '"';
      continue;
    }

    if (ch === '"') {
      out += '\\"';
      continue;
    }

    if (ch === "\n") {
      out += "\\n";
      continue;
    }

    if (ch === "\r") {
      out += "\\r";
      continue;
    }

    out += ch;
  }

  // 未加引号的键 → 加引号
  return out.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
}

/** 从 MCP 响应中取出文本块内容 */
function extractTextBlock(raw: string): string | null {
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
    return `__ERROR__${obj.error.message || "MCP error"}`;
  }

  const content = obj?.result?.content;

  if (!Array.isArray(content)) return null;

  const block = content.find((c) => c?.type === "text" && typeof c.text === "string");

  return block?.text ?? null;
}

/** 把接口返回的单条航班归一化 */
function normalizeFlight(raw: Record<string, unknown>): VariflightFlight | null {
  const flightNumber = String(raw.flightno || "").trim();

  if (!flightNumber) return null;

  const cabinsRaw = Array.isArray(raw.cabins) ? raw.cabins : [];

  const cabins: VariflightCabin[] = cabinsRaw
    .map((c) => {
      const cabin = c as Record<string, unknown>;
      const price = Number(cabin.price);

      if (!Number.isFinite(price) || price <= 0) return null;

      return {
        cabinClass: String(cabin.cabinclass || ""),
        className: String(cabin.classname || ""),
        cabinCode: String(cabin.cabincode || ""),
        discount: Number.isFinite(Number(cabin.discount)) ? Number(cabin.discount) : null,
        price,
        standardPrice: Number.isFinite(Number(cabin.stprice)) ? Number(cabin.stprice) : null,
        seats: Number.isFinite(Number(cabin.seatnum)) ? Number(cabin.seatnum) : null,
      };
    })
    .filter((c): c is VariflightCabin => c !== null);

  const depTs = Number(raw.flightdeptimeplandate);
  const arrTs = Number(raw.flightarrtimeplandate);

  return {
    flightNumber,
    airline: flightNumber.slice(0, 2),
    depAirport: String(raw.depaptcname || ""),
    arrAirport: String(raw.arraptcname || ""),
    depCode: String(raw.flightdepcode || ""),
    arrCode: String(raw.flightarrcode || ""),
    departAt: Number.isFinite(depTs) && depTs > 0 ? depTs * 1000 : null,
    arriveAt: Number.isFinite(arrTs) && arrTs > 0 ? arrTs * 1000 : null,
    distance: Number.isFinite(Number(raw.distance)) ? Number(raw.distance) : null,
    hasStop: Number(raw.stopflag) > 0,
    cabins,
  };
}

/**
 * 按出发/到达城市与日期查询航班票价。
 *
 * 失败返回 { flights: [], error }，不抛异常 —— 与项目既有的降级策略一致。
 */
export async function fetchFlightPrices(
  depCity: string,
  arrCity: string,
  depDate: string,
): Promise<VariflightPriceResult> {
  const key = process.env.VARIFLIGHT_API_KEY?.trim();

  if (!key) {
    return { flights: [], error: "未配置 VARIFLIGHT_API_KEY" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(AVIATION_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "X-API-Key": key,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "getFlightPriceByCities",
          arguments: {
            dep_city: depCity.toUpperCase(),
            arr_city: arrCity.toUpperCase(),
            dep_date: depDate,
          },
        },
        id: 1,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { flights: [], error: `飞常准返回 HTTP ${res.status}` };
    }

    const textBlock = extractTextBlock(await res.text());

    if (!textBlock) {
      return { flights: [], error: "飞常准响应无法解析" };
    }

    if (textBlock.startsWith("__ERROR__")) {
      return { flights: [], error: `飞常准接口报错：${textBlock.slice(9)}` };
    }

    let data: unknown;

    try {
      data = JSON.parse(pythonDictToJson(textBlock));
    } catch {
      return { flights: [], error: "飞常准返回的数据格式无法解析" };
    }

    const obj = data as Record<string, unknown>;

    if (Number(obj.code) !== 200) {
      return { flights: [], error: `飞常准返回失败：${String(obj.message || obj.code)}` };
    }

    const list = Array.isArray(obj.data) ? obj.data : [];

    const flights = list
      .map((item) => normalizeFlight(item as Record<string, unknown>))
      .filter((f): f is VariflightFlight => f !== null);

    return { flights, error: null };
  } catch (e) {
    const msg = String(e);

    return {
      flights: [],
      error: msg.includes("abort")
        ? "飞常准请求超时"
        : `飞常准请求异常：${msg.slice(0, 80)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从航班列表中取指定舱位的最低报价。
 *
 * @param cabinKeyword 舱位中文名关键词，默认「经济」
 */
export function lowestPrice(
  flights: VariflightFlight[],
  cabinKeyword = "经济",
): { price: number; flight: VariflightFlight } | null {
  let best: { price: number; flight: VariflightFlight } | null = null;

  for (const f of flights) {
    for (const c of f.cabins) {
      if (cabinKeyword && !c.className.includes(cabinKeyword)) continue;

      // 防御：价格非正的舱位不可作为报价（接口偶发返回 0）
      if (!Number.isFinite(c.price) || c.price <= 0) continue;

      if (!best || c.price < best.price) {
        best = { price: c.price, flight: f };
      }
    }
  }

  return best;
}

// ============================================================
// 火车票（Tripmatch MCP）
// ============================================================

/** Tripmatch 端点：提供火车票与空铁联运 */
const TRIPMATCH_MCP_URL = "https://ai.variflight.com/servers/tripmatch/mcp";

/** 一个座席报价 */
export interface TrainSeat {
  /** 座席名，如「二等座」 */
  seatName: string;
  /** 票价（元） */
  price: number;
  /** 余票数；接口用 -1 或缺失表示未知 */
  ticketsLeft: number | null;
}

/** 一趟列车（已归一化） */
export interface TrainTicket {
  /** 车次，如 G532 */
  trainNumber: string;
  /** 出发站名 */
  fromStation: string;
  /** 到达站名 */
  toStation: string;
  /** 发车时刻 HH:mm */
  departTime: string;
  /** 到达时刻 HH:mm */
  arriveTime: string;
  /** 历时（分钟） */
  durationMinutes: number;
  /** 各座席报价 */
  seats: TrainSeat[];
}

/** 火车票查询结果 */
export interface TrainTicketResult {
  trains: TrainTicket[];
  error: string | null;
}

/** 把接口返回的单趟列车归一化 */
function normalizeTrain(raw: Record<string, unknown>): TrainTicket | null {
  const trainNumber = String(raw.trainNumber || "").trim();

  if (!trainNumber) return null;

  const seatsRaw = Array.isArray(raw.seatLists) ? raw.seatLists : [];

  const seats: TrainSeat[] = seatsRaw
    .map((s) => {
      const seat = s as Record<string, unknown>;
      const price = Number(seat.seatPrice);

      if (!Number.isFinite(price) || price <= 0) return null;

      const left = Number(seat.ticketLeft);

      return {
        seatName: String(seat.seatName || ""),
        price,
        ticketsLeft: Number.isFinite(left) ? left : null,
      };
    })
    .filter((s): s is TrainSeat => s !== null);

  const useTime = Number(raw.useTime);

  return {
    trainNumber,
    fromStation: String(raw.fromStation || ""),
    toStation: String(raw.toStation || ""),
    departTime: String(raw.fromTime || ""),
    arriveTime: String(raw.toTime || ""),
    durationMinutes: Number.isFinite(useTime) && useTime > 0 ? useTime : 0,
    seats,
  };
}

/**
 * 按出发/到达城市与日期查询火车票。
 *
 * 注意：参数用的是**中文城市名**（如「上海」「北京」），
 * 与机票接口用 IATA 三字码不同 —— 实测确认。
 *
 * 失败返回 { trains: [], error }，不抛异常。
 */
export async function fetchTrainTickets(
  fromCity: string,
  toCity: string,
  date: string,
): Promise<TrainTicketResult> {
  const key = process.env.VARIFLIGHT_API_KEY?.trim();

  if (!key) {
    return { trains: [], error: "未配置 VARIFLIGHT_API_KEY" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(TRIPMATCH_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "X-API-Key": key,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "searchTrainTickets",
          arguments: {
            from_city: fromCity,
            to_city: toCity,
            date,
          },
        },
        id: 1,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { trains: [], error: `飞常准火车票返回 HTTP ${res.status}` };
    }

    const textBlock = extractTextBlock(await res.text());

    if (!textBlock) {
      return { trains: [], error: "飞常准火车票响应无法解析" };
    }

    if (textBlock.startsWith("__ERROR__")) {
      return { trains: [], error: `飞常准火车票接口报错：${textBlock.slice(9)}` };
    }

    let data: unknown;

    try {
      data = JSON.parse(pythonDictToJson(textBlock));
    } catch {
      return { trains: [], error: "飞常准火车票数据格式无法解析" };
    }

    const obj = data as Record<string, unknown>;

    if (Number(obj.code) !== 200) {
      return { trains: [], error: `飞常准火车票返回失败：${String(obj.message || obj.code)}` };
    }

    // 实测结构是嵌套的：{ code, message, data: { code, msg, data: [...] } }
    const inner = obj.data as Record<string, unknown> | undefined;
    const list = Array.isArray(inner?.data)
      ? (inner.data as unknown[])
      : Array.isArray(obj.data)
        ? (obj.data as unknown[])
        : [];

    const trains = list
      .map((item) => normalizeTrain(item as Record<string, unknown>))
      .filter((t): t is TrainTicket => t !== null);

    return { trains, error: null };
  } catch (e) {
    const msg = String(e);

    return {
      trains: [],
      error: msg.includes("abort")
        ? "飞常准火车票请求超时"
        : `飞常准火车票请求异常：${msg.slice(0, 80)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 不推荐的座席：无座在长途上不可接受，只在无其它选择时才用 */
const DISCOURAGED_SEATS = ["无座"];

/**
 * 取某趟列车指定座席的最低票价。
 *
 * 座席偏好按档位映射（见 intercityOptions 的说明）：
 * 经济型看二等座，品质型看一等座，奢华看商务座。
 *
 * 「无座」被排除在正常选择之外 —— 实测它常常是最低价，
 * 于是慢车 + 无座会被排到高铁前面，这对用户毫无价值。
 * 只有当该车次除无座外无票时，才退回无座。
 */
export function lowestSeatPrice(
  train: TrainTicket,
  preferredSeats: string[],
): { seatName: string; price: number } | null {
  const choose = (candidates: TrainSeat[]): { seatName: string; price: number } | null => {
    let best: TrainSeat | null = null;

    for (const seat of candidates) {
      if (!Number.isFinite(seat.price) || seat.price <= 0) continue;

      if (!best || seat.price < best.price) best = seat;
    }

    return best ? { seatName: best.seatName, price: best.price } : null;
  };

  const seated = train.seats.filter(
    (s) => !DISCOURAGED_SEATS.some((d) => s.seatName.includes(d)),
  );

  // 按偏好顺序命中
  for (const pref of preferredSeats) {
    const hit = choose(seated.filter((s) => s.seatName.includes(pref)));

    if (hit) return hit;
  }

  // 偏好都没命中时，在非无座里取最低价
  const anySeated = choose(seated);

  if (anySeated) return anySeated;

  // 最后才考虑无座
  return choose(train.seats);
}

// ============================================================
// 空铁联运（Tripmatch）
// ============================================================

/** 联运方案中的一段（可能是航班或火车） */
export interface TransferSegment {
  /** 段类型：「航班」或「火车」 */
  kind: string;
  /** 班次号，如 MU5826 或 G2789 */
  number: string;
  /** 出发站/机场名 */
  fromName: string;
  /** 出发三字码 */
  fromCode: string;
  /** 到达站/机场名 */
  toName: string;
  /** 到达三字码 */
  toCode: string;
  /** 出发时间（毫秒时间戳） */
  departAt: number | null;
  /** 到达时间（毫秒时间戳） */
  arriveAt: number | null;
}

/** 一个联运方案（由若干段组成） */
export interface TransferItinerary {
  segments: TransferSegment[];
  /** 是否含火车段 */
  hasTrain: boolean;
  /** 是否含航班段 */
  hasFlight: boolean;
  /** 总历时（分钟），由首段出发到末段到达推算 */
  durationMinutes: number;
  /** 中转城市名（中间段的到达城市），无中转时为空数组 */
  transferCities: string[];
}

/** 联运查询结果 */
export interface TransferResult {
  itineraries: TransferItinerary[];
  error: string | null;
}

/** 把接口返回的一段归一化 */
function normalizeSegment(raw: Record<string, unknown>): TransferSegment | null {
  const number = String(raw.num || "").trim();

  if (!number) return null;

  const dep = Number(raw.deptime);
  const arr = Number(raw.arrtime);

  return {
    kind: String(raw.type || "").trim(),
    number,
    fromName: String(raw.src || ""),
    fromCode: String(raw.srcCode || ""),
    toName: String(raw.dst || ""),
    toCode: String(raw.dstCode || ""),
    departAt: Number.isFinite(dep) && dep > 0 ? dep : null,
    arriveAt: Number.isFinite(arr) && arr > 0 ? arr : null,
  };
}

/**
 * 查询空铁联运方案。
 *
 * 接口行为（实测确认）：
 *   · 返回的是「方案列表」，每个方案由 1 至多段组成，
 *     段类型可能是「航班」或「火车」—— 这是它区别于纯机票查询的关键
 *   · **不返回价格**，只有班次与时刻，票价需另行估算
 *   · 对已有多班直达车的线路价值有限（拉萨→上海只给直飞），
 *     对缺少直达的小城市线路价值明显（盐城→北京给出 9 个火车方案，
 *     含「盐城→徐州东 ＋ 徐州东→北京南」这类中转）
 *
 * 参数用 IATA 三字码（与火车票接口用中文城市名不同）。
 */
export async function fetchTransferItineraries(
  depCity: string,
  arrCity: string,
  depDate: string,
  limit = 12,
): Promise<TransferResult> {
  const key = process.env.VARIFLIGHT_API_KEY?.trim();

  if (!key) {
    return { itineraries: [], error: "未配置 VARIFLIGHT_API_KEY" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(TRIPMATCH_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "X-API-Key": key,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "getFlightAndTrainTransferInfo",
          arguments: {
            depcity: depCity.toUpperCase(),
            arrcity: arrCity.toUpperCase(),
            depdate: depDate,
            limit,
            // summary 足以拿到班次与时刻；full 会显著放大响应体积
            detail: "summary",
          },
        },
        id: 1,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { itineraries: [], error: `联运查询返回 HTTP ${res.status}` };
    }

    const textBlock = extractTextBlock(await res.text());

    if (!textBlock) {
      return { itineraries: [], error: "联运响应无法解析" };
    }

    if (textBlock.startsWith("__ERROR__")) {
      return { itineraries: [], error: `联运接口报错：${textBlock.slice(9)}` };
    }

    let data: unknown;

    try {
      data = JSON.parse(pythonDictToJson(textBlock));
    } catch {
      return { itineraries: [], error: "联运数据格式无法解析" };
    }

    const obj = data as Record<string, unknown>;

    if (Number(obj.code) !== 200) {
      return { itineraries: [], error: `联运返回失败：${String(obj.message || obj.code)}` };
    }

    // data 是「方案的数组」，每个方案是「段的数组」
    const rawOptions = Array.isArray(obj.data) ? (obj.data as unknown[]) : [];

    const itineraries: TransferItinerary[] = [];

    for (const raw of rawOptions) {
      if (!Array.isArray(raw) || raw.length === 0) continue;

      const segments = raw
        .map((s) => normalizeSegment(s as Record<string, unknown>))
        .filter((s): s is TransferSegment => s !== null);

      if (segments.length === 0) continue;

      const first = segments[0];
      const last = segments[segments.length - 1];

      const durationMinutes =
        first.departAt !== null && last.arriveAt !== null && last.arriveAt > first.departAt
          ? Math.round((last.arriveAt - first.departAt) / 60000)
          : 0;

      // 中转城市：中间段的到达地名（去掉「市」「机场」后缀便于展示）
      const transferCities = segments
        .slice(0, -1)
        .map((s) => s.toName.replace(/机场$/, "").replace(/市$/, ""));

      itineraries.push({
        segments,
        hasTrain: segments.some((s) => s.kind.includes("火车")),
        hasFlight: segments.some((s) => s.kind.includes("航班")),
        durationMinutes,
        transferCities,
      });
    }

    return { itineraries, error: null };
  } catch (e) {
    const msg = String(e);

    return {
      itineraries: [],
      error: msg.includes("abort") ? "联运查询超时" : `联运查询异常：${msg.slice(0, 80)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从联运方案中挑选可用的中转方案。
 *
 * 优先级：
 *   1. 含火车段的方案（「飞机接高铁」）—— 这是空铁联运特有的价值，
 *      纯航班中转与机票查询重复
 *   2. 没有火车段时，回退到纯航班中转方案 —— 在缺直达的线路上，
 *      它们仍比「无方案」有用（实测西双版纳→上海只有航班中转）
 *
 * 同类中取段数最少的：段数越多换乘越麻烦。接口按相关度排序，
 * 前几条常是直飞，因此需要自己筛。
 */
export function pickTransferItineraries(
  itineraries: TransferItinerary[],
  max = 2,
): TransferItinerary[] {
  const byPreference = (a: TransferItinerary, b: TransferItinerary) => {
    if (a.segments.length !== b.segments.length) {
      return a.segments.length - b.segments.length;
    }

    return a.durationMinutes - b.durationMinutes;
  };

  // 只考虑多段方案：单段的就是直达，与其它查询重复
  const multiLeg = itineraries.filter((it) => it.segments.length >= 2);

  const withTrain = multiLeg.filter((it) => it.hasTrain).sort(byPreference);

  if (withTrain.length > 0) {
    return withTrain.slice(0, max);
  }

  return multiLeg
    .filter((it) => it.hasFlight)
    .sort(byPreference)
    .slice(0, max);
}
