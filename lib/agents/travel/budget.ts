/**
 * 预算分配算法。
 *
 * 为什么要单独做算法而不是让模型算钱：
 * 模型做算术会出错，而且错得很隐蔽（各项相加对不上总额、人均算错）。
 * 所以金额一律在这里用确定性代码算出来，模型只负责「花钱的内容」
 * （哪天去哪、吃什么），金额由本模块回填和校验。
 *
 * 分配策略分三种情形：
 * A. 交通/住宿拿到真实报价 → 按报价锁定金额，剩余预算动态分给其他科目
 * B. 只有估算价 → 交通/住宿按估算锁定，剩余预算动态分配
 * C. 预算比「最低可行成本」还低 → 仍给出分配，但 feasible=false 并说明差距
 */

import type {
  BudgetCategory,
  BudgetCategoryKey,
  BudgetPlan,
  FlightQuote,
  HotelQuote,
  TravelParty,
  TravelStyle,
} from "./types";

/** 弹性科目：预算扣掉锁定项后，在这些科目之间动态分配 */
type FlexibleKey = "accommodation" | "food" | "activities" | "shopping" | "contingency";

interface StylePreset {
  label: string;
  /** 初始权重，用于计算弹性科目的分配比例 */
  weights: Record<FlexibleKey, number>;
  /** 住宿下限：每间每晚（元） */
  hotelFloorPerRoomNight: number;
  /** 正餐下限：每人每天（元） */
  foodFloorPerPersonDay: number;
  /** 门票体验下限：每人每天（元） */
  activityFloorPerPersonDay: number;
  /** 住宿档次说明 */
  hotelGrade: string;
}

/** 各档位的权重与下限。权重之和为 1，便于直接当比例用 */
const PRESETS: Record<TravelStyle, StylePreset> = {
  budget: {
    label: "经济型",
    weights: {
      accommodation: 0.4,
      food: 0.35,
      activities: 0.15,
      shopping: 0.02,
      contingency: 0.08,
    },
    hotelFloorPerRoomNight: 150,
    foodFloorPerPersonDay: 80,
    activityFloorPerPersonDay: 40,
    hotelGrade: "快捷酒店或青旅",
  },
  comfort: {
    label: "舒适型",
    weights: {
      accommodation: 0.45,
      food: 0.25,
      activities: 0.18,
      shopping: 0.05,
      contingency: 0.07,
    },
    hotelFloorPerRoomNight: 350,
    foodFloorPerPersonDay: 150,
    activityFloorPerPersonDay: 80,
    hotelGrade: "三至四星酒店或优质民宿",
  },
  premium: {
    label: "品质型",
    weights: {
      accommodation: 0.45,
      food: 0.25,
      activities: 0.2,
      shopping: 0.05,
      contingency: 0.05,
    },
    hotelFloorPerRoomNight: 700,
    foodFloorPerPersonDay: 260,
    activityFloorPerPersonDay: 150,
    hotelGrade: "四至五星酒店",
  },
  luxury: {
    label: "奢享型",
    weights: {
      accommodation: 0.45,
      food: 0.25,
      activities: 0.2,
      shopping: 0.06,
      contingency: 0.04,
    },
    hotelFloorPerRoomNight: 1500,
    foodFloorPerPersonDay: 500,
    activityFloorPerPersonDay: 300,
    hotelGrade: "五星酒店或度假村",
  },
};

/** 各科目的中文名 */
const LABELS: Record<BudgetCategoryKey, string> = {
  transport: "交通",
  accommodation: "住宿",
  food: "餐饮",
  activities: "门票与体验",
  shopping: "购物与伴手礼",
  contingency: "备用金",
};

/** 最低可行成本的长途交通兜底值（拿不到报价时用） */
const FALLBACK_TRANSPORT_PER_PERSON: Record<TravelStyle, number> = {
  budget: 400,
  comfort: 700,
  premium: 1300,
  luxury: 2400,
};

/** 系数保留 4 位小数，避免浮点尾差 */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** 人数相关的最小值：0 与 base 取大，保证不出现负分配 */
function atLeastZero(value: number): number {
  return value > 0 ? value : 0;
}

/**
 * 按权重把 total 分给若干科目，并保证「和为 total」。
 *
 * 做法：先按权重向下取整，再把因取整损失的零头按「损失最大者优先」
 * 依次补给各项，每项最多补 1 元。这样既不会出现某科目拿到 0 元，
 * 也保证合计精确等于 total。
 */
export function distributeByWeight(
  total: number,
  weights: Record<string, number>,
): Record<string, number> {
  const keys = Object.keys(weights);
  const result: Record<string, number> = {};

  if (keys.length === 0 || total <= 0) {
    for (const key of keys) {
      result[key] = 0;
    }

    return result;
  }

  const weightSum = keys.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);

  if (weightSum <= 0) {
    // 权重全为 0 时退化为均分
    const each = Math.floor(total / keys.length);

    for (const key of keys) {
      result[key] = each;
    }

    return result;
  }

  const floors: Record<string, number> = {};
  const fractions: Array<{ key: string; fraction: number }> = [];
  let used = 0;

  for (const key of keys) {
    const exact = (total * Math.max(0, weights[key])) / weightSum;
    const floored = Math.floor(exact);

    floors[key] = floored;
    fractions.push({ key, fraction: exact - floored });
    used += floored;
  }

  fractions.sort((a, b) => b.fraction - a.fraction);

  let remainder = total - used;
  let index = 0;

  // 零头逐元发放；极端情况下（remainder 大于科目数）循环发放
  while (remainder > 0 && fractions.length > 0) {
    const target = fractions[index % fractions.length];

    floors[target.key] += 1;
    remainder -= 1;
    index += 1;
  }

  for (const key of keys) {
    result[key] = floors[key];
  }

  return result;
}

/** 分配上下文：由调用方提供已确定的价格与行程参数 */
export interface BudgetContext {
  total: number;
  party: TravelParty;
  nights: number;
  days: number;
  style: TravelStyle;
  flight: FlightQuote | null;
  hotel: HotelQuote | null;
  /** 需要预订的房间数 */
  rooms: number;
  /** 是否旺季（旺季会抬高估算下限） */
  peakSeason: boolean;
}

/**
 * 计算一行预算科目，自动补齐比例与人均。
 */
function toCategory(
  key: BudgetCategoryKey,
  amount: number,
  total: number,
  headcount: number,
  lockedByQuote: boolean,
  detail: string,
): BudgetCategory {
  const safeAmount = Math.max(0, Math.floor(amount));

  return {
    key,
    label: LABELS[key],
    amount: safeAmount,
    ratio: total > 0 ? round4(safeAmount / total) : 0,
    perPerson: headcount > 0 ? Math.round(safeAmount / headcount) : safeAmount,
    lockedByQuote,
    detail,
  };
}

/**
 * 构建预算分配方案。
 *
 * 返回值中的 allocated 保证等于 total（算法末尾有断言式校验），
 * feasible 表示预算是否达到该目的地的最低可行成本。
 */
export function buildBudgetPlan(context: BudgetContext): BudgetPlan {
  const { total, party, nights, days, style, flight, hotel, rooms, peakSeason } = context;

  const preset = PRESETS[style];
  const headcount = Math.max(1, party.adults + party.children);

  // 旺季住宿与门票普遍上浮，直接抬高下限参与可行性判断
  const seasonFactor = peakSeason ? 1.35 : 1;

  const diagnoses: string[] = [];

  // ---------- 1. 锁定项：交通与住宿 ----------
  // 有真实报价就用真实报价；没有报价但不代表没有成本，用估算值占位。
  const transportAmount = flight
    ? flight.totalPrice
    : Math.round(FALLBACK_TRANSPORT_PER_PERSON[style] * headcount * seasonFactor);

  const transportDetail = flight
    ? `${flight.confidence === "live" ? "真实报价" : "估算"}：${flight.outbound[0]?.from ?? ""} → ${
        flight.outbound[0]?.to ?? ""
      } 往返，单人 ${flight.pricePerAdult} 元`
    : `未取得机票报价，按 ${preset.label}长途往返人均 ${FALLBACK_TRANSPORT_PER_PERSON[style]} 元估算`;

  const hotelNightlyEstimate = Math.round(preset.hotelFloorPerRoomNight * seasonFactor);

  const accommodationAmount =
    hotel && nights > 0
      ? hotel.totalPrice
      : nights > 0
        ? Math.round(hotelNightlyEstimate * nights * rooms)
        : 0;

  const accommodationDetail =
    nights === 0
      ? "一日游，无需住宿"
      : hotel
        ? `${hotel.confidence === "live" ? "真实报价" : "估算"}：${hotel.name}，${rooms} 间 × ${nights} 晚`
        : `未取得住宿报价，按${preset.hotelGrade}约 ${hotelNightlyEstimate} 元/间/晚估算`;

  // ---------- 2. 弹性科目 ----------
  const floors: Record<FlexibleKey, number> = {
    accommodation: accommodationAmount,
    food: Math.round(preset.foodFloorPerPersonDay * headcount * Math.max(1, days) * seasonFactor),
    activities: Math.round(
      preset.activityFloorPerPersonDay * headcount * Math.max(1, days) * seasonFactor,
    ),
    shopping: 0,
    contingency: 0,
  };

  // 无住宿需求（一日游）时，住宿不占预算，权重转移给餐饮与体验
  const weights: Record<FlexibleKey, number> = { ...preset.weights };

  if (nights === 0) {
    weights.accommodation = 0;

    const redistributed = preset.weights.accommodation;

    weights.food += redistributed * 0.5;
    weights.activities += redistributed * 0.5;
  }

  const flexibleBudget = atLeastZero(total - transportAmount);
  const distribution = distributeByWeight(flexibleBudget, weights);

  const values: Record<FlexibleKey, number> = {
    accommodation: distribution.accommodation ?? 0,
    food: distribution.food ?? 0,
    activities: distribution.activities ?? 0,
    shopping: distribution.shopping ?? 0,
    contingency: distribution.contingency ?? 0,
  };

  // 报价锁定的住宿金额以真实/估算报价为准，覆盖分配结果
  if (flight || hotel) {
    values.accommodation = accommodationAmount;
  }

  // ---------- 3. 下限兜底 ----------
  // 按最低生活成本补足餐饮与门票体验；差额从购物、备用金、住宿依次回收，
  // 避免「为了省钱把饭钱压到 0」这种明显不合理的方案。
  //
  // 注意每个科目的 donor 列表必须排除自身：否则 pullFromOthers 会从目标
  // 科目里取钱再放回去，净效果为零，看起来补足了其实没补。
  const extras: Array<{ key: FlexibleKey; label: string; donors: FlexibleKey[] }> = [
    { key: "food", label: "餐饮", donors: ["shopping", "contingency", "accommodation"] },
    {
      key: "activities",
      label: "门票与体验",
      donors: ["shopping", "contingency", "food", "accommodation"],
    },
  ];

  for (const { key, label, donors } of extras) {
    const gap = floors[key] - values[key];

    if (gap <= 0) {
      continue;
    }

    const recouped = pullFromOthers(values, key, gap, donors);

    if (recouped < gap) {
      diagnoses.push(
        `${label}按最低标准需 ${floors[key]} 元，当前预算仅能安排 ${values[key]} 元，建议提高预算或减少天数`,
      );
    }
  }

  // ---------- 4. 住宿报价与预算冲突 ----------
  if (flight && hotel && values.accommodation > total) {
    diagnoses.push("机票与住宿已超出总预算，建议缩短行程或更换目的地");
  }

  // ---------- 5. 可行性 ----------
  const minimumViable =
    transportAmount +
    (nights > 0 ? Math.round(hotelNightlyEstimate * nights * rooms) : 0) +
    floors.food +
    floors.activities;

  const feasible = total >= minimumViable;

  if (!feasible) {
    diagnoses.push(
      `该目的地最低可行预算约 ${minimumViable} 元，当前预算 ${total} 元，缺口约 ${
        minimumViable - total
      } 元`,
    );
  }

  // ---------- 6. 组装 ----------
  const categoryList: BudgetCategory[] = [
    toCategory(
      "transport",
      transportAmount,
      total,
      headcount,
      Boolean(flight),
      transportDetail,
    ),
    toCategory(
      "accommodation",
      values.accommodation,
      total,
      headcount,
      Boolean(flight || hotel),
      accommodationDetail,
    ),
    toCategory(
      "food",
      values.food,
      total,
      headcount,
      false,
      `人均每日约 ${Math.round(values.food / headcount / Math.max(1, days))} 元，按${preset.label}餐饮标准${peakSeason ? "（旺季上浮）" : ""}`,
    ),
    toCategory(
      "activities",
      values.activities,
      total,
      headcount,
      false,
      `含景区门票、演出与体验项目，人均每日约 ${Math.round(
        values.activities / headcount / Math.max(1, days),
      )} 元`,
    ),
    toCategory("shopping", values.shopping, total, headcount, false, "伴手礼与临时采购，可自由压减"),
    toCategory(
      "contingency",
      values.contingency,
      total,
      headcount,
      false,
      "应对临时改签、打车、药品等突发支出",
    ),
  ];

  const allocated = categoryList.reduce((sum, item) => sum + item.amount, 0);

  // 自校验：分配必须精确等于总预算。若不等，把差额补给备用金，
  // 这道兜底保证前端永远显示「合计 = 总预算」，不会出现对不上账。
  if (allocated !== total) {
    const delta = total - allocated;
    const contingency = categoryList.find((item) => item.key === "contingency");

    if (contingency) {
      contingency.amount += delta;
      contingency.ratio = round4(contingency.amount / total);
      contingency.perPerson = Math.round(contingency.amount / headcount);
    } else {
      categoryList.push(
        toCategory("contingency", delta, total, headcount, false, "分配差额调整"),
      );
    }
  }

  const finalAllocated = categoryList.reduce((sum, item) => sum + item.amount, 0);

  if (peakSeason) {
    diagnoses.push("出行日期处于旺季（暑假/黄金周/春节），住宿与门票普遍上浮，报价浮动较大");
  }

  if (!flight || flight.confidence === "estimate") {
    diagnoses.push("交通与住宿为估算值，非实时报价，仅用于预算规划");
  }

  return {
    total,
    currency: "CNY",
    categories: categoryList,
    allocated: finalAllocated,
    perPerson: Math.round(total / headcount),
    perPersonPerDay: Math.round(total / headcount / Math.max(1, days)),
    minimumViable,
    feasible,
    diagnosis: diagnoses,
  };
}

/**
 * 把其它科目的金额挪给目标科目，返回实际挪到的金额。
 * 回收顺序由调用方给定，从弹性最大的科目开始。
 */
export function pullFromOthers(
  values: Record<string, number>,
  target: string,
  need: number,
  donors: string[],
): number {
  let collected = 0;

  for (const donor of donors) {
    if (collected >= need || donor === target) {
      continue;
    }

    const available = values[donor] ?? 0;

    if (available <= 0) {
      continue;
    }

    const take = Math.min(available, need - collected);

    values[donor] = available - take;
    collected += take;
  }

  values[target] = (values[target] ?? 0) + collected;

  return collected;
}

/** 暴露档位预设，供报价估算与 Prompt 复用 */
export function getStylePreset(style: TravelStyle): StylePreset {
  return PRESETS[style];
}

/** 暴露科目中文名，供 Prompt 复用 */
export function getCategoryLabels(): Record<BudgetCategoryKey, string> {
  return LABELS;
}
