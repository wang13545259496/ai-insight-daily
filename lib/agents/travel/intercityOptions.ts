/**
 * 跨城出行方案对比：火车与自驾。
 *
 * 为什么需要这个模块：原有的 `fetchCommute` 只在**市内**两点之间选通勤方式
 * （步行/公交/驾车），跨城场景下它的候选方式只有公交与驾车，
 * 而国内中长途的实际主力是高铁——这条线此前完全没有覆盖。
 *
 * 两种方式的成本口径不同，不能直接相加比较：
 *   火车：按人头计价（每人一张票）
 *   自驾：按车计价（油费 + 过路费由同车人分摊）
 * 因此模块统一输出「全团总价」，并额外给出人均，便于用户判断。
 *
 * 数据来源：
 *   火车 飞常准 Tripmatch（真实票价与余票）
 *   自驾 高德驾车路径规划（真实距离、时长、过路费）+ 油费估算
 *        油费无法从接口获得（取决于车型与油价），用可解释的经验值计算。
 */

import { estimateDrivingCost, fetchDrivingRoute, isAmapConfigured } from "./amap";
import { estimatePerAdultFare, routeDistance } from "./fareEstimate";
import { isMajorRoute, trainPriorityScore } from "./stationRank";
import type { TravelParty, TravelStyle } from "./types";
import {
  fetchTrainTickets,
  fetchTransferItineraries,
  isVariflightConfigured,
  lowestSeatPrice,
  pickTransferItineraries,
} from "./variflight";
import type { TrainTicket } from "./variflight";

/** 出行方式 */
export type IntercityMode = "train" | "drive" | "flight" | "transfer";

/** 一个跨城方案 */
export interface IntercityOption {
  mode: IntercityMode;
  /** 方式名，如「高铁」 */
  label: string;
  /** 全团总价（元） */
  totalPrice: number;
  /** 人均价（元） */
  perPerson: number;
  /** 单程历时（分钟） */
  durationMinutes: number;
  /** 车次/路线标识，如「G532」或「京沪高速」 */
  reference: string;
  /** 出发—到达时刻（火车有；自驾无固定时刻，为空串） */
  departTime: string;
  arriveTime: string;
  /** 费用明细说明 */
  breakdown: string;
  /** 数据可信度 */
  confidence: "live" | "estimate";
}

/** 对比结果 */
export interface IntercityComparison {
  options: IntercityOption[];
  warnings: string[];
}

/**
 * 按档位选择火车座席偏好。
 *
 * 顺序即优先级：命中前一个就不再往后看。
 * 经济型看二等座，品质型看一等座，奢华型看商务座。
 * 「无座」不列入偏好——长途无座不是合理推荐。
 */
const TRAIN_SEAT_PREFERENCE: Record<TravelStyle, string[]> = {
  budget: ["二等座", "硬座", "硬卧"],
  comfort: ["二等座", "一等座", "硬卧"],
  premium: ["一等座", "二等座", "软卧"],
  luxury: ["商务座", "一等座"],
};

/** 自驾之外是否还考虑火车：超过此直线距离时火车通常更划算 */
const DRIVE_MAX_KM = 1500;

/** 最多返回几个方案（火车） */
const MAX_OPTIONS = 4;

/**
 * 自驾时间的折算价值（元/分钟）。
 *
 * 用途：把自驾的耗时分摊进成本，使它与火车可比。
 * 取值 0.8 元/分钟 ≈ 48 元/小时，接近国内城市间出行的常见时间价值水平。
 *
 * 为什么需要它：自驾的人均费用常与高铁接近，但耗时长得多。
 * 实测北京→天津：自驾 2 小时 21 分、人均 ¥54；高铁 34 分钟、人均 ¥51。
 * 只比价格会让自驾排到前面，而实际选择显然相反。
 * 折算后自驾为 54 + 141×0.8 ≈ 167，高铁为 51，排序正确。
 */
const TIME_VALUE_PER_MINUTE = 0.8;

/** 座席名是否卧铺 */
const isSleeper = (seatName: string) => /卧/.test(seatName);

/**
 * 是否「夕发朝至」。
 *
 * 三个条件缺一不可：
 *   1. 傍晚之后发车（17 点起）
 *   2. 次日中午前到达（12 点前）
 *   3. 历时足够长（6 小时以上）
 *
 * 第 3 条是实测补上的：北京→天津的 23:59 发车、01:25 到达的硬卧，
 * 历时仅 1 小时 26 分，却因「傍晚发车 + 凌晨到达」被判为夕发朝至，
 * 于是提示「可省一晚住宿」—— 短途夜车显然不省住宿。
 */
function isOvernight(train: TrainTicket): boolean {
  const dep = Number(train.departTime.slice(0, 2));
  const arr = Number(train.arriveTime.slice(0, 2));

  if (!Number.isFinite(dep) || !Number.isFinite(arr)) return false;

  return dep >= 17 && arr <= 12 && train.durationMinutes >= 360;
}

/**
 * 查询火车方案。
 *
 * @param passengerCount 同行人数（火车按人头计价）
 */
export async function fetchTrainOptions(
  fromCity: string,
  toCity: string,
  date: string,
  style: TravelStyle,
  passengerCount: number,
): Promise<{ options: IntercityOption[]; error: string | null }> {
  if (!isVariflightConfigured()) {
    return { options: [], error: "未配置 VARIFLIGHT_API_KEY" };
  }

  const result = await fetchTrainTickets(fromCity, toCity, date);

  if (result.error) {
    return { options: [], error: result.error };
  }

  if (result.trains.length === 0) {
    return { options: [], error: null };
  }

  const preference = TRAIN_SEAT_PREFERENCE[style] ?? TRAIN_SEAT_PREFERENCE.comfort;

  // 每趟车取一个价，过滤掉取不到价的
  const priced = result.trains
    .map((train) => {
      const seat = lowestSeatPrice(train, preference);
      return seat ? { train, seat } : null;
    })
    .filter(
      (x): x is { train: TrainTicket; seat: { seatName: string; price: number } } => x !== null,
    );

  if (priced.length === 0) {
    return { options: [], error: null };
  }

  /**
   * 排序策略：枢纽度优先，价格与耗时其次。
   *
   * 为什么不用「按价格取前三」：实测「上海→杭州」按价取前三得到的是
   * 上海松江、金山北这类远郊站发车的车次，而用户预期的是虹桥。
   * 详见 stationRank.ts 的权重校准说明。
   *
   * 为什么也要看价格与耗时：只按枢纽度排会把最贵的高铁排第一，
   * 而同一枢纽站往往有多个价位的车次。
   */
  const scored = priced
    .map((item) => ({
      ...item,
      score: trainPriorityScore({
        fromStation: item.train.fromStation,
        toStation: item.train.toStation,
        trainNumber: item.train.trainNumber,
        price: item.seat.price,
        durationMinutes: item.train.durationMinutes,
        originCity: fromCity,
        destinationCity: toCity,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  /**
   * 结果选择：显式覆盖「综合最优 / 最便宜 / 最快」三种诉求。
   *
   * 为什么不只用分数取前 N 名：实测「上海→北京」按分数取前四，
   * 结果是四个耗时与价格都接近的高铁，界面上的「最低价」与「最快」
   * 徽标落在同一行，用户真正会问的三个问题没有各自得到回答。
   */
  const picked = pickTrainOptions(scored);

  const options: IntercityOption[] = picked.map(({ train, seat }) => {
    const total = seat.price * passengerCount;

    const overnightNote =
      isSleeper(seat.seatName) && isOvernight(train) ? "｜夕发朝至，可省一晚住宿" : "";

    const majorNote = isMajorRoute(train.fromStation, train.toStation, fromCity, toCity)
      ? ""
      : "｜非枢纽站发车，注意预留接驳时间";

    return {
      mode: "train" as const,
      label: train.trainNumber.startsWith("G")
        ? "高铁"
        : train.trainNumber.startsWith("D")
          ? "动车"
          : isSleeper(seat.seatName)
            ? "卧铺"
            : "普速",
      totalPrice: total,
      perPerson: seat.price,
      durationMinutes: train.durationMinutes,
      reference: train.trainNumber,
      departTime: train.departTime,
      arriveTime: train.arriveTime,
      // 时刻与历时已在独立列展示，此处不再重复，只保留列里没有的信息
      breakdown: `${train.fromStation}→${train.toStation}｜${seat.seatName}${overnightNote}${majorNote}`,
      confidence: "live",
    };
  });

  return { options, error: null };
}

/** 同一对起降车站最多保留几趟 */
const MAX_PER_STATION_PAIR = 2;

/**
 * 结果选择：显式覆盖「综合最优 / 最便宜 / 最快」三种诉求。
 *
 * 为什么不只用分数取前 N 名：实测「上海→北京」按分数取前四，
 * 结果是四个耗时与价格都接近的高铁，界面上的「最低价」与「最快」
 * 徽标落在同一行，用户真正会问的三个问题没有各自得到回答。
 */
function pickTrainOptions<
  T extends { train: TrainTicket; seat: { seatName: string; price: number } },
>(scored: T[]): T[] {
  const picked: T[] = [];
  const pairCount = new Map<string, number>();

  const add = (item: T | undefined) => {
    if (!item) return;
    if (picked.some((p) => p.train.trainNumber === item.train.trainNumber)) return;

    const pair = `${item.train.fromStation}→${item.train.toStation}`;
    const used = pairCount.get(pair) ?? 0;

    if (used >= MAX_PER_STATION_PAIR) return;

    pairCount.set(pair, used + 1);
    picked.push(item);
  };

  // 1. 综合最优（枢纽度 + 高铁 + 价格 + 耗时）
  add(scored[0]);

  // 2. 最便宜
  add([...scored].sort((a, b) => a.seat.price - b.seat.price)[0]);

  // 3. 最快
  add([...scored].sort((a, b) => a.train.durationMinutes - b.train.durationMinutes)[0]);

  // 4. 其余按分数补齐
  for (const item of scored) {
    if (picked.length >= MAX_OPTIONS) break;

    add(item);
  }

  return picked.slice(0, MAX_OPTIONS);
}

/**
 * 查询自驾方案。
 *
 * 费用按车计（油费 + 过路费），不随人数增加；
 * 因此给出人均价，供与火车按人头的价格对比。
 */
export async function fetchDriveOption(
  originCity: string,
  destinationCity: string,
  passengerCount: number,
  options: { fuelPer100Km?: number; fuelPricePerLiter?: number } = {},
): Promise<{ option: IntercityOption | null; error: string | null }> {
  if (!isAmapConfigured()) {
    return { option: null, error: "未配置 AMAP_WEB_KEY，无法计算自驾路线" };
  }

  // 高德驾车接口接受城市名作为起终点；这里再兜一层，
  // 确保「自驾对比」出问题也只是少一个选项，不会让整份方案失败
  let route: Awaited<ReturnType<typeof fetchDrivingRoute>> = null;

  try {
    route = await fetchDrivingRoute(originCity, destinationCity);
  } catch (error) {
    return { option: null, error: `高德驾车接口暂时不可用：${String(error).slice(0, 80)}` };
  }

  if (!route) {
    return { option: null, error: "高德未返回驾车路线（可能超出覆盖范围或两地不可达）" };
  }

  const km = Math.round(route.distanceMeters / 1000);

  if (km > DRIVE_MAX_KM) {
    return { option: null, error: `距离 ${km} 公里，超出自驾合理范围（${DRIVE_MAX_KM} 公里）` };
  }

  const cost = estimateDrivingCost(route.distanceMeters, route.tolls, options);

  const hours = Math.floor(route.durationMinutes / 60);
  const mins = route.durationMinutes % 60;

  const perPerson = Math.max(1, Math.round(cost.total / Math.max(1, passengerCount)));

  return {
    option: {
      mode: "drive",
      label: "自驾",
      // 自驾通常是往返，但火车报价是单程——为可比，这里统一按单程计
      totalPrice: cost.total,
      perPerson,
      durationMinutes: route.durationMinutes,
      reference: route.summary || `${originCity}→${destinationCity}`,
      departTime: "",
      arriveTime: "",
      breakdown:
        `全程约 ${km} 公里，预计 ${hours}小时${mins}分｜` +
        `油费约 ¥${cost.fuel}${cost.tolls > 0 ? ` + 过路费 ¥${cost.tolls}` : "（无过路费）"}` +
        ` = ¥${cost.total}/车，${passengerCount} 人分摊约 ¥${perPerson}/人`,
      confidence: "estimate",
    },
    error: null,
  };
}

/**
 * 查询空铁联运方案（仅在缺少直达车次时调用）。
 *
 * 价格处理：联运接口**不返回票价**，只有班次与时刻。
 * 因此按各段的起降城市对查坐标、算大圆距离，再用 fareEstimate
 * 的定价模型估算 —— 与「机票距离估算」同一口径，标注为 estimate。
 *
 * 为什么按「每段单程 × 2」算往返：接口给的是单程方案，
 * 而其余方案的人均价也是单程口径，保持一致才能横向比较。
 */
export async function fetchTransferOptions(params: {
  originCode: string;
  destinationCode: string;
  departDate: string;
  passengerCount: number;
}): Promise<{ options: IntercityOption[]; error: string | null }> {
  if (!isVariflightConfigured()) {
    return { options: [], error: "未配置 VARIFLIGHT_API_KEY" };
  }

  const result = await fetchTransferItineraries(
    params.originCode,
    params.destinationCode,
    params.departDate,
  );

  if (result.error) {
    return { options: [], error: result.error };
  }

  const picked = pickTransferItineraries(result.itineraries, 2);

  if (picked.length === 0) {
    return { options: [], error: null };
  }

  const options: IntercityOption[] = [];

  for (const itinerary of picked) {
    // 按段累加距离，再套用定价模型
    let totalDistanceKm = 0;
    let unknownLegs = 0;

    for (const seg of itinerary.segments) {
      const d =
        routeDistance(seg.fromCode, seg.toCode) ??
        // 火车站三字码不在航空坐标表里，退回用城市名匹配
        routeDistance(codeOfCityName(seg.fromName), codeOfCityName(seg.toName));

      if (d === null) {
        unknownLegs++;
      } else {
        totalDistanceKm += d;
      }
    }

    // 全部段都无法算距离时无法估价，跳过
    if (totalDistanceKm === 0) continue;

    const perAdult = estimatePerAdultFare({
      distanceKm: totalDistanceKm,
      roundTrip: true,
      cabin: "economy",
      peakSeason: false,
      daysUntilDeparture: null,
    });

    const first = itinerary.segments[0];
    const last = itinerary.segments[itinerary.segments.length - 1];

    const fmtTime = (ms: number | null) =>
      ms === null
        ? ""
        : new Date(ms).toLocaleTimeString("zh-CN", {
            timeZone: "Asia/Shanghai",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

    const hours = Math.floor(itinerary.durationMinutes / 60);
    const mins = itinerary.durationMinutes % 60;

    const legText = itinerary.segments
      .map((s) => `${s.kind === "火车" ? "火车" : "航班"} ${s.number} ${s.fromName}→${s.toName}`)
      .join(" ＋ ");

    // 标签区分「空铁联运」与「航班中转」：前者是飞机接高铁，
    // 后者只是转机，用户看到的预期不同
    const label = itinerary.hasTrain ? "空铁联运" : "航班中转";

    options.push({
      mode: "transfer",
      label,
      totalPrice: perAdult * params.passengerCount,
      perPerson: perAdult,
      durationMinutes: itinerary.durationMinutes,
      reference: itinerary.segments.map((s) => s.number).join("+"),
      departTime: fmtTime(first.departAt),
      arriveTime: fmtTime(last.arriveAt),
      breakdown:
        `${legText}（${hours}小时${mins}分）｜需自行分段购票` +
        `｜价格按航程 ${totalDistanceKm} 公里估算${unknownLegs > 0 ? `，其中 ${unknownLegs} 段距离未知` : ""}`,
      confidence: "estimate",
    });
  }

  return { options, error: null };
}

/**
 * 把站名/机场名转成坐标表里可能存在的城市码。
 *
 * 联运返回的火车站三字码（如 SZQ 深圳、AFH 盐城）与航空城市码
 * （SZX、YNZ）不同，因此优先用名称匹配：去掉「机场」「市」后缀后，
 * 在城市的坐标表里按名称反查。
 */
function codeOfCityName(name: string): string {
  const cleaned = String(name || "")
    .replace(/机场$/, "")
    .replace(/站$/, "")
    .replace(/市$/, "")
    .trim();

  if (!cleaned) return "";

  // 坐标表的键是 IATA 码，这里用一份小的中文名 → 码映射兜底
  return CITY_NAME_TO_CODE[cleaned] ?? cleaned;
}

/** 常见城市中文名 → IATA 城市码（用于火车站名反查坐标） */
const CITY_NAME_TO_CODE: Record<string, string> = {
  北京: "BJS",
  上海: "SHA",
  广州: "CAN",
  深圳: "SZX",
  成都: "CTU",
  重庆: "CKG",
  杭州: "HGH",
  南京: "NKG",
  武汉: "WUH",
  西安: "XIY",
  长沙: "CSX",
  昆明: "KMG",
  厦门: "XMN",
  青岛: "TAO",
  天津: "TSN",
  郑州: "CGO",
  三亚: "SYX",
  海口: "HAK",
  拉萨: "LXA",
  乌鲁木齐: "URC",
  哈尔滨: "HRB",
  沈阳: "SHE",
  大连: "DLC",
  济南: "TNA",
  福州: "FOC",
  南宁: "NNG",
  贵阳: "KWE",
  盐城: "YNZ",
  徐州: "XUZ",
  赣州: "KOW",
  宿迁: "SQD",
  济南西: "TNA",
  徐州东: "XUZ",
};

/**
 * 对比火车与自驾方案。
 *
 * 两者并行查询；任一失败不影响另一个 —— 与项目既有的降级策略一致。
 * 返回结果按「人均价」升序，便于用户先看到便宜的。
 */
export async function compareIntercityOptions(params: {
  originCity: string;
  destinationCity: string;
  /**
   * 出发/到达的 IATA 三字码。
   * 空铁联运接口用三字码（与火车票用中文城市名不同），
   * 缺省时跳过联运查询。
   */
  originCode?: string;
  destinationCode?: string;
  departDate: string;
  party: TravelParty;
  style: TravelStyle;
  /** 是否包含自驾（默认包含） */
  includeDrive?: boolean;
  /**
   * 机票报价。仅在「既无直达车次、又无联运方案」时使用 ——
   * 此时若不给兜底，跨城区块会整块消失，而用户明明可以坐飞机。
   */
  flightQuote?: {
    pricePerAdult: number;
    totalPrice: number;
    totalDurationMinutes: number;
    confidence: "live" | "estimate";
    outbound: Array<{ from: string; to: string; departAt: string; arriveAt: string; flightNumber: string }>;
  } | null;
}): Promise<IntercityComparison> {
  const passengerCount = Math.max(1, params.party.adults + params.party.children);
  const warnings: string[] = [];
  const options: IntercityOption[] = [];

  const wantDrive = params.includeDrive !== false;

  const [trainResult, driveResult] = await Promise.all([
    fetchTrainOptions(
      params.originCity,
      params.destinationCity,
      params.departDate,
      params.style,
      passengerCount,
    ),
    wantDrive
      ? fetchDriveOption(params.originCity, params.destinationCity, passengerCount)
      : Promise.resolve({ option: null, error: null }),
  ]);

  if (trainResult.error) {
    warnings.push(`火车方案查询失败：${trainResult.error}`);
  } else if (trainResult.options.length === 0) {
    warnings.push(`${params.originCity}→${params.destinationCity} 未查到可售车次`);
  } else {
    options.push(...trainResult.options);
  }

  if (driveResult.error) {
    warnings.push(`自驾方案不可用：${driveResult.error}`);
  } else if (driveResult.option) {
    options.push(driveResult.option);
  }

  // ---------- 缺直达时的兜底：空铁联运，其次机票 ----------
  // 触发条件：火车查询失败或没有结果。理由有两条 ——
  //   1. 联运接口按次计费，有直达车次时它提供不了额外价值
  //      （实测拉萨→上海只返回直飞方案）
  //   2. 它**不返回价格**，只能按距离估算，精度低于直达车次的实时票价
  const lacksDirect = trainResult.options.length === 0;

  if (lacksDirect && params.originCode && params.destinationCode && isVariflightConfigured()) {
    const transfer = await fetchTransferOptions({
      originCode: params.originCode,
      destinationCode: params.destinationCode,
      departDate: params.departDate,
      passengerCount,
    });

    if (transfer.error) {
      warnings.push(`空铁联运查询失败：${transfer.error}`);
    } else if (transfer.options.length > 0) {
      options.push(...transfer.options);
      warnings.push(
        `未查到直达车次，已补充 ${transfer.options.length} 个` +
          `${transfer.options[0].label}方案（价格按航线距离估算，且需分段购票）`,
      );
    }
  }

  // ---------- 仍然没有任何方案时，用机票兜底 ----------
  // 实测西双版纳→上海属于这种情况：无直达火车、自驾 2890 公里超出范围、
  // 联运接口也只返回直飞（没有多段组合）。此时若无兜底，
  // 跨城区块会整块消失 —— 而用户明明可以坐飞机。
  if (options.length === 0 && params.flightQuote) {
    const f = params.flightQuote;

    options.push({
      mode: "flight",
      label: "航班",
      totalPrice: f.totalPrice,
      perPerson: f.pricePerAdult,
      // 航班总历时含往返两段，单程取一半作为对比口径
      durationMinutes: Math.round(f.totalDurationMinutes / 2),
      reference: f.outbound[0]?.flightNumber ?? "航班",
      departTime: (f.outbound[0]?.departAt ?? "").slice(11, 16),
      arriveTime: (f.outbound[0]?.arriveAt ?? "").slice(11, 16),
      breakdown:
        `${f.outbound[0]?.from ?? ""} → ${f.outbound[0]?.to ?? ""} 直飞` +
        `｜${f.confidence === "live" ? "实时票价" : "估算"}` +
        `｜无直达车次，此为可用的替代方式`,
      confidence: f.confidence,
    });
  }

  options.sort((a, b) => {
    // 自驾与火车用不同的排序键，因为两者的「代价」结构不同：
    //   火车：票价是主要代价，车上时间可休息，时间权重低
    //   自驾：开车是净消耗（无法休息），时间本身就是显著代价
    //
    // 实测教训：北京→天津的 2 小时 21 分自驾（人均 ¥54）与
    // 34 分钟高铁（人均 ¥51）人均价几乎相同，若统一按人均价排，
    // 自驾会排到高铁前面 —— 但没有人会为了省 3 元多开两小时车。
    const costKey = (o: IntercityOption) =>
      o.mode === "drive"
        ? o.perPerson + o.durationMinutes * TIME_VALUE_PER_MINUTE
        : o.perPerson;

    const ca = costKey(a);
    const cb = costKey(b);

    if (Math.abs(ca - cb) > 0.5) return ca - cb;

    return a.durationMinutes - b.durationMinutes;
  });

  return { options, warnings };
}
