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
import type { TravelParty, TravelStyle } from "./types";
import { fetchTrainTickets, isVariflightConfigured, lowestSeatPrice } from "./variflight";
import type { TrainTicket } from "./variflight";

/** 出行方式 */
export type IntercityMode = "train" | "drive" | "flight";

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
   * 为什么不能只按价格排序：
   * 实测「上海→北京」按价格取前三，结果是 14-22 小时的普速硬卧/无座，
   * 而 4 小时 24 分的高铁被排到最后 —— 用户看到这种推荐会认为系统坏了。
   *
   * 但也不能只按速度排序：夜间卧铺（夕发朝至）虽然慢，
   * 却省下一晚住宿，对预算型用户是实际优势。
   *
   * 因此分三组各取代表，再合并：
   *   1. 高铁/动车里最快的（时效优先）
   *   2. 高铁/动车里最便宜的（性价比）
   *   3. 夜间卧铺（夕发朝至，省一晚住宿）
   *   4. 其余里最便宜的（兜底，覆盖无高铁的线路）
   */
  const isHighSpeed = (t: TrainTicket) => /^[GD]/.test(t.trainNumber);

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
  const isOvernight = (t: TrainTicket) => {
    const dep = Number(t.departTime.slice(0, 2));
    const arr = Number(t.arriveTime.slice(0, 2));

    if (!Number.isFinite(dep) || !Number.isFinite(arr)) return false;

    return dep >= 17 && arr <= 12 && t.durationMinutes >= 360;
  };

  const highSpeed = priced.filter((p) => isHighSpeed(p.train));
  const sleepers = priced.filter((p) => isSleeper(p.seat.seatName) && isOvernight(p.train));

  const picked: Array<{ train: TrainTicket; seat: { seatName: string; price: number } }> = [];
  const push = (item?: { train: TrainTicket; seat: { seatName: string; price: number } }) => {
    if (!item) return;
    if (picked.some((p) => p.train.trainNumber === item.train.trainNumber)) return;

    picked.push(item);
  };

  // 1. 高铁最快
  push([...highSpeed].sort((a, b) => a.train.durationMinutes - b.train.durationMinutes)[0]);

  // 2. 高铁最便宜
  push([...highSpeed].sort((a, b) => a.seat.price - b.seat.price)[0]);

  // 3. 夜间卧铺里最快的
  push([...sleepers].sort((a, b) => a.train.durationMinutes - b.train.durationMinutes)[0]);

  // 4. 其余里最便宜的
  push([...priced].sort((a, b) => a.seat.price - b.seat.price)[0]);

  if (picked.length === 0) {
    return { options: [], error: null };
  }

  const options: IntercityOption[] = picked.map(({ train, seat }) => {
    const total = seat.price * passengerCount;
    const hours = Math.floor(train.durationMinutes / 60);
    const mins = train.durationMinutes % 60;
    const durationText = hours > 0 ? `${hours}小时${mins}分` : `${mins}分`;

    const overnightNote =
      isSleeper(seat.seatName) && isOvernight(train) ? "｜夕发朝至，可省一晚住宿" : "";

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
      breakdown:
        `${train.fromStation}→${train.toStation} ${train.departTime}-${train.arriveTime}` +
        `（${durationText}）｜${seat.seatName} ¥${seat.price}/人 × ${passengerCount} 人${overnightNote}`,
      confidence: "live",
    };
  });

  return { options, error: null };
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

  // 高德驾车接口接受城市名作为起终点
  const route = await fetchDrivingRoute(originCity, destinationCity);

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
 * 对比火车与自驾方案。
 *
 * 两者并行查询；任一失败不影响另一个 —— 与项目既有的降级策略一致。
 * 返回结果按「人均价」升序，便于用户先看到便宜的。
 */
export async function compareIntercityOptions(params: {
  originCity: string;
  destinationCity: string;
  departDate: string;
  party: TravelParty;
  style: TravelStyle;
  /** 是否包含自驾（默认包含） */
  includeDrive?: boolean;
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

  // 按人均价排序；同价时按耗时短的优先
  options.sort((a, b) => {
    if (a.perPerson !== b.perPerson) return a.perPerson - b.perPerson;
    return a.durationMinutes - b.durationMinutes;
  });

  return { options, warnings };
}
