/**
 * 行程解析与成本回填。
 *
 * 这里是「模型输出」到「可信行程」之间唯一的关口，做三件事：
 * 1. 宽进严出地解析模型 JSON：字段缺失就补，类型不对就丢，绝不抛给上层
 * 2. 把模型给出的 weight 归一化，按预算科目回填金额（模型不参与算钱）
 * 3. 模型不可用或输出不可用时，用确定性模板兜底，保证功能永远有结果
 */

import { buildDateRange, weekdayLabel } from "./date";
import type {
  BudgetPlan,
  ItineraryActivity,
  ItineraryDay,
  TravelPlan,
  TripQuery,
} from "./types";

/** 模型输出的活动草稿：只有 weight，没有金额 */
interface ActivityDraft {
  startTime: string;
  endTime: string;
  title: string;
  kind: ItineraryActivity["kind"];
  location?: string;
  description: string;
  weight: number;
}

/** 模型输出的单日草稿 */
export interface DayDraft {
  day: number;
  date: string;
  theme: string;
  accommodation: string;
  tips?: string;
  activities: ActivityDraft[];
}

/** 模型输出的整体结构。days 按位对齐 dates，解析失败的位置为 null */
export interface ItineraryDraft {
  overview: string;
  days: Array<DayDraft | null>;
  checklist: string[];
  tips: string[];
}

/** 合法活动类型，用于拦截模型自造的类型 */
const ACTIVITY_KINDS: ItineraryActivity["kind"][] = [
  "sight",
  "meal",
  "transport",
  "experience",
  "rest",
];

/** 时间格式 HH:mm，并宽松接受 H:mm */
function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return fallback;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return fallback;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** 截断过长文本，防止模型跑题输出大段文字撑爆页面 */
function clampText(value: unknown, maxLength: number, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim().replace(/\s+/g, " ");

  if (trimmed.length === 0) {
    return fallback;
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

/** 提取字符串数组，过滤空值并限长 */
function readStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];

  for (const item of value) {
    const text = clampText(item, maxLength);

    if (text.length > 0) {
      result.push(text);
    }

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

/** 解析单个活动草稿；标题缺失则丢弃（返回 null） */
function parseActivity(value: unknown, fallbackStart: string): ActivityDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  const title = clampText(raw.title, 60);

  if (title.length === 0) {
    return null;
  }

  const kind = ACTIVITY_KINDS.includes(raw.kind as ItineraryActivity["kind"])
    ? (raw.kind as ItineraryActivity["kind"])
    : "sight";

  const rawWeight = typeof raw.weight === "number" ? raw.weight : Number(raw.weight);
  const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? Math.min(rawWeight, 10) : 1;

  const startTime = normalizeTime(raw.startTime, fallbackStart);
  const endTime = normalizeTime(raw.endTime, startTime);

  return {
    startTime,
    endTime,
    title,
    kind,
    location: clampText(raw.location, 60) || undefined,
    description: clampText(raw.description, 200, "行程安排"),
    weight,
  };
}

/** 解析单日草稿；日期以调用方给定的 dates 为准，不接受模型自填 */
function parseDay(value: unknown, index: number): DayDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  const rawActivities = Array.isArray(raw.activities) ? raw.activities : [];
  const activities: ActivityDraft[] = [];

  const defaultSlots = ["09:00", "12:00", "14:30", "18:00", "20:00"];

  rawActivities.forEach((item, activityIndex) => {
    const parsed = parseActivity(item, defaultSlots[activityIndex % defaultSlots.length]);

    if (parsed) {
      activities.push(parsed);
    }
  });

  // 一天没有任何活动视为无效，交由上层补模板，避免出现空白日
  if (activities.length === 0) {
    return null;
  }

  const rawDay = typeof raw.day === "number" ? raw.day : Number(raw.day);

  return {
    day: Number.isFinite(rawDay) && rawDay > 0 ? Math.round(rawDay) : index + 1,
    // 日期由 dates 数组统一回填，这里留空以免模型自填的日期混入结果
    date: "",
    theme: clampText(raw.theme, 30, `第 ${index + 1} 天`),
    accommodation: clampText(raw.accommodation, 80, ""),
    tips: clampText(raw.tips, 160) || undefined,
    activities,
  };
}

/**
 * 解析模型输出为行程草稿。
 * 任何结构性问题都返回 null，由调用方走模板兜底，不在这里抛错。
 *
 * 关键设计：days 的长度恒等于 dates.length，解析失败的那天填 null。
 * 如果解析失败就直接跳过，后面所有天的下标都会前移，与日期错配
 * （第 3 天的内容被安到第 2 天上），这是比缺一天更糟的错误。
 */
export function parseItineraryDraft(text: string, dates: string[]): ItineraryDraft | null {
  const parsed = parseJsonObject(text);

  if (!parsed) {
    return null;
  }

  const rawDays = Array.isArray(parsed.days) ? parsed.days : [];
  const days: Array<DayDraft | null> = [];

  // 按位置逐一对应：模型多给的丢弃，少给或解析失败的留 null 由模板补
  for (let index = 0; index < dates.length; index++) {
    days.push(parseDay(rawDays[index], index));
  }

  // 一天都没解析出来，说明模型输出完全不可用
  if (days.every((day) => day === null)) {
    return null;
  }

  const overview = clampText(parsed.overview, 600);

  return {
    overview,
    days,
    checklist: readStringArray(parsed.checklist, 12, 120),
    tips: readStringArray(parsed.tips, 10, 160),
  };
}

/** 宽容地从文本中抠出 JSON 对象，兼容代码围栏与前后废话 */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const withoutFence = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const candidates = [withoutFence];

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start !== -1 && end > start) {
    candidates.push(withoutFence.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as unknown;

      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    } catch {
      // 尝试下一个候选
    }
  }

  return null;
}

/**
 * 按权重把总金额分配到各项，并保证合计精确等于 total。
 * 与预算分配用的是同一套「向下取整 + 补零头」思路。
 */
export function allocateByWeight(weights: number[], total: number): number[] {
  if (weights.length === 0) {
    return [];
  }

  if (total <= 0) {
    return weights.map(() => 0);
  }

  const sum = weights.reduce((acc, weight) => acc + Math.max(0, weight), 0);

  // 权重全为 0 时均分，避免出现除零
  const normalized = sum > 0 ? weights.map((weight) => Math.max(0, weight) / sum) : weights.map(() => 1 / weights.length);

  const floors = normalized.map((ratio) => Math.floor(ratio * total));
  const used = floors.reduce((acc, value) => acc + value, 0);

  const fractions = normalized
    .map((ratio, index) => ({ index, fraction: ratio * total - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  let remainder = total - used;
  let cursor = 0;

  while (remainder > 0 && fractions.length > 0) {
    floors[fractions[cursor % fractions.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return floors;
}

/**
 * 把每日草稿落成带金额的正式行程。
 *
 * drafts 允许含 null（模型没给出或解析失败的那天），这里统一用
 * 「空白日」占位，保证输出天数与 dates 严格一致，不会少一天。
 */
export function finalizeItinerary(
  drafts: Array<DayDraft | null>,
  budget: BudgetPlan,
  dates: string[],
  query: TripQuery,
): ItineraryDay[] {
  const activitiesBudget = budget.categories.find((item) => item.key === "activities")?.amount ?? 0;

  const mealBudget = budget.categories.find((item) => item.key === "food")?.amount ?? 0;

  // 空白日占位：没有活动，仅保留日期与住宿说明，避免整段行程缺天
  const filled: DayDraft[] = drafts.map((day, index) =>
    day ?? {
      day: index + 1,
      date: "",
      theme: `第 ${index + 1} 天`,
      accommodation: "",
      activities: [],
    },
  );

  // 门票体验预算只分给非餐饮活动；餐饮预算按天均分给餐饮活动
  const payableWeights = filled.map((day) =>
    day.activities.map((activity) => (activity.kind === "meal" ? 0 : activity.weight)),
  );

  const flatWeights = payableWeights.flat();
  const flatCosts = allocateByWeight(flatWeights, activitiesBudget);

  // 餐饮预算：按天数均分，再在当天的餐饮活动间按权重分
  const mealPerDay = allocateByWeight(
    filled.map(() => 1),
    mealBudget,
  );

  let cursor = 0;

  return filled.map((day, dayIndex) => {
    const mealWeights = day.activities.map((activity) =>
      activity.kind === "meal" ? activity.weight : 0,
    );

    const dayMealCosts = allocateByWeight(mealWeights, mealPerDay[dayIndex] ?? 0);

    let dayTotal = 0;

    const activities: ItineraryActivity[] = day.activities.map((activity, activityIndex) => {
      // 餐饮用按天独立分配的金额，其余活动取全局分配数组中的对应位置。
      //
      // 这里必须用「活动在全局中的绝对下标」cursor 去取 flatCosts，
      // 而不能用「第几个非餐饮活动」去取：flatCosts 是按全部活动的位置
      // 一一对应生成的，用相对序号会整体错位，导致金额被记到别的活动上。
      const cost = activity.kind === "meal" ? (dayMealCosts[activityIndex] ?? 0) : (flatCosts[cursor] ?? 0);

      cursor += 1;
      dayTotal += cost;

      return {
        startTime: activity.startTime,
        endTime: activity.endTime,
        title: activity.title,
        kind: activity.kind,
        description: activity.description,
        estimatedCost: cost,
        costSource: "estimate",
        location: activity.location,
      };
    });

    return {
      day: dayIndex + 1,
      date: dates[dayIndex] ?? day.date,
      theme: day.theme,
      activities,
      estimatedCost: dayTotal,
      accommodation: day.accommodation || defaultAccommodation(query, dayIndex, filled.length),
      tips: day.tips,
    };
  });
}

/** 住宿说明兜底 */
function defaultAccommodation(query: TripQuery, dayIndex: number, totalDays: number): string {
  if (dayIndex === totalDays - 1) {
    return "返程日，无需住宿";
  }

  return `入住${query.destination}市区酒店，便于次日出行`;
}

/** 模板兜底产物：逐日内容必然完整，因此 days 不含 null */
export interface TemplateDraft {
  days: DayDraft[];
  overview: string;
  checklist: string[];
  tips: string[];
}

/**
 * 确定性模板兜底。
 *
 * 它不是「凑数」：当模型不可用时，用户仍应拿到一份结构完整、
 * 金额正确的方案（日期、预算、交通、住宿都对），只是内容通用。
 * 首日与末日按交通日处理，中间日按「上午景点 + 下午体验 + 晚间餐饮」编排。
 */
export function buildTemplateDraft(
  query: TripQuery,
  plan: Pick<TravelPlan, "quotes" | "budget">,
  dates: string[],
): TemplateDraft {
  const days: DayDraft[] = dates.map((date, index) => {
    const isFirst = index === 0;
    const isLast = index === dates.length - 1;
    const isOnly = isFirst && isLast;

    const activities: ActivityDraft[] = [];

    if (isFirst && !isOnly) {
      activities.push({
        startTime: "08:00",
        endTime: "12:00",
        title: "出发与飞行",
        kind: "transport",
        location: `${query.origin} → ${query.destination}`,
        description: `办理值机与安检，飞往${query.destination}。建议提前 2 小时到达机场，托运行李并确认返程机票状态。`,
        weight: 0,
      });

      activities.push({
        startTime: "14:00",
        endTime: "15:30",
        title: "入住与休整",
        kind: "rest",
        location: "酒店",
        description: "办理入住、放置行李并稍作休整，熟悉酒店周边交通与便利店位置。",
        weight: 0,
      });

      activities.push({
        startTime: "17:30",
        endTime: "20:00",
        title: `${query.destination}夜市或步行街初体验`,
        kind: "meal",
        location: "市区核心商圈",
        description: "以轻松的逛吃结束第一天，适应目的地气候与口味，不建议安排高强度行程。",
        weight: 1.2,
      });
    } else if (isLast && !isOnly) {
      activities.push({
        startTime: "09:00",
        endTime: "11:30",
        title: "退房与最后的采买",
        kind: "experience",
        location: "酒店周边",
        description: "退房并寄存行李，就近采买伴手礼，避免临近航班时匆忙。",
        weight: 1,
      });

      activities.push({
        startTime: "12:00",
        endTime: "13:30",
        title: "返程前的一餐",
        kind: "meal",
        location: "前往机场沿线",
        description: "选择出餐快的本地餐馆，预留充足时间前往机场。",
        weight: 1,
      });

      activities.push({
        startTime: "14:30",
        endTime: "19:00",
        title: "返程飞行",
        kind: "transport",
        location: `${query.destination} → ${query.origin}`,
        description: "前往机场、办理登机并返回出发地。建议国内航班提前 2 小时、国际航班提前 3 小时到达。",
        weight: 0,
      });
    } else {
      activities.push({
        startTime: "08:30",
        endTime: "09:30",
        title: "早餐与出发准备",
        kind: "meal",
        location: "酒店或周边小店",
        description: "补充体力并确认当日路线，带上饮水与充电宝。",
        weight: 0.8,
      });

      activities.push({
        startTime: "09:30",
        endTime: "12:00",
        title: `${query.destination}核心景点游览`,
        kind: "sight",
        location: "首选景区",
        description: `上午人流较少、光线适合拍照，建议提前在官方渠道预约${query.destination}的热门景区门票。`,
        weight: 2,
      });

      activities.push({
        startTime: "12:30",
        endTime: "13:30",
        title: "当地特色午餐",
        kind: "meal",
        location: "景区周边",
        description: "就近选择评价较高的本地餐馆，避开景区门口的溢价门店。",
        weight: 1,
      });

      activities.push({
        startTime: "14:00",
        endTime: "17:00",
        title: "深度体验或博物馆",
        kind: "experience",
        location: "市区",
        description: `安排一项${query.interests[0] ?? "当地特色"}相关的深度体验，室内项目可兼顾避雨避晒。`,
        weight: 1.8,
      });

      activities.push({
        startTime: "18:00",
        endTime: "20:30",
        title: "晚餐与夜景",
        kind: "meal",
        location: "观景点或商业街",
        description: "晚餐后散步看夜景，注意末班公共交通时间，必要时打车回酒店。",
        weight: 1.1,
      });
    }

    return {
      day: index + 1,
      date,
      theme: isFirst && !isOnly ? "抵达与初探" : isLast && !isOnly ? "收尾与返程" : "经典一日",
      accommodation: defaultAccommodation(query, index, dates.length),
      activities,
    };
  });

  const headcount = query.party.adults + query.party.children;

  return {
    days,
    overview: `本方案按${query.origin}往返${query.destination}、${dates.length} 天 ${
      dates.length - 1
    } 晚、${headcount} 人、总预算 ${plan.budget.total} 元规划，人均约 ${plan.budget.perPerson} 元。交通与住宿费用已按${
      plan.quotes.flight?.confidence === "live" ? "实时报价" : "估算值"
    }锁定，其余科目按当地消费水平分配。每日行程按上午景点、下午体验、晚间餐饮的节奏编排，预留了机动时间，可根据天气与体力灵活调整。`,
    checklist: [
      "身份证、护照及签证（出境需确认有效期 6 个月以上）",
      "往返机票与酒店预订确认单（建议打印或离线保存）",
      "常用药品：感冒药、肠胃药、创可贴、防蚊用品",
      "充电器、充电宝（随身携带，不可托运）与转换插头",
      "按当地气候准备的衣物与舒适的步行鞋",
      "旅行保险保单（含医疗与行程取消保障）",
      "少量现金与可用的移动支付方式",
      "提前下载离线地图与翻译应用",
    ],
    tips: [
      `提前 2 小时（国内）或 3 小时（国际）到达机场，${weekdayLabel(query.departDate)}出发客流通常较大`,
      "热门景区普遍需要实名预约，建议出发前 1-3 天完成预约",
      plan.budget.feasible
        ? "预算已覆盖主要支出，仍建议保留备用金应对临时改签与打车"
        : "预算低于最低可行成本，建议优先压缩购物与高价体验项目，或减少行程天数",
      "门票、住宿价格随日期浮动明显，确定行程后尽早预订通常更便宜",
      "在目的地使用正规平台打车，避免在机场、车站跟随揽客人员",
      "留意当地节假日，景区可能限流，行程宜留出弹性",
    ],
  };
}


/**
 * 按新预算重新分配活动金额，保留坐标、通勤等地图数据。
 *
 * 为什么需要它：预算在询价后就算好了，而市内打车费要到地图增强后
 * 才知道。打车费会挤占餐饮与门票的弹性额度，因此预算需要重算一次。
 *
 * 但**不能**用 finalizeItinerary 重建行程——那会拿模型的原始草稿重新生成，
 * 把刚补好的 coordinates / address / commuteFromPrevious / commuteLegs
 * 全部抹掉。实测症状：有打车费、却没有任何通勤与坐标。
 * 这里只改金额，其余字段原样保留。
 */
export function repriceItinerary(itinerary: ItineraryDay[], budget: BudgetPlan): ItineraryDay[] {
  if (itinerary.length === 0) {
    return itinerary;
  }

  const activitiesBudget = budget.categories.find((item) => item.key === "activities")?.amount ?? 0;
  const mealBudget = budget.categories.find((item) => item.key === "food")?.amount ?? 0;

  // 门票体验额度只分给非餐饮活动；餐饮额度按天均分后再在当天餐饮活动间分配
  const flatCosts = allocateByWeight(
    itinerary.flatMap((day) =>
      day.activities.map((activity) => (activity.kind === "meal" ? 0 : 1)),
    ),
    activitiesBudget,
  );

  const mealPerDay = allocateByWeight(
    itinerary.map(() => 1),
    mealBudget,
  );

  let cursor = 0;

  return itinerary.map((day, dayIndex) => {
    const dayMealCosts = allocateByWeight(
      day.activities.map((activity) => (activity.kind === "meal" ? 1 : 0)),
      mealPerDay[dayIndex] ?? 0,
    );

    let dayTotal = 0;

    const activities = day.activities.map((activity, activityIndex) => {
      const cost =
        activity.kind === "meal" ? (dayMealCosts[activityIndex] ?? 0) : (flatCosts[cursor] ?? 0);

      cursor += 1;
      dayTotal += cost;

      return { ...activity, estimatedCost: cost };
    });

    return { ...day, activities, estimatedCost: dayTotal };
  });
}

/**
 * 把草稿补齐到完整天数：模型少给的天用模板补。
 *
 * 按「下标」对齐而不是按 date 对齐：解析阶段为了不让模型自填的日期混入
 * 结果，刻意把 date 置空，因此按 date 建索引会全部匹配失败，导致模型
 * 生成的内容被模板整份覆盖（且 generatedByAI 仍报 true，属于假成功）。
 * 解析层已保证 days[i] 对应 dates[i]，按下标取用是正确的对齐方式。
 */
export function fillMissingDays(
  draft: ItineraryDraft,
  fallback: TemplateDraft,
  dates: string[],
): ItineraryDraft {
  const days: Array<DayDraft | null> = [];

  for (let index = 0; index < dates.length; index++) {
    // 优先用模型给的这一天，缺失（null）才回退模板的对应天
    const day = draft.days[index] ?? fallback.days[index] ?? null;

    days.push(day);
  }

  return {
    overview: draft.overview || fallback.overview,
    days,
    checklist: draft.checklist.length > 0 ? draft.checklist : fallback.checklist,
    tips: draft.tips.length > 0 ? draft.tips : fallback.tips,
  };
}

/** 统计草稿中真正由模型生成的天数（null 为未生成） */
export function countGeneratedDays(draft: ItineraryDraft): number {
  return draft.days.filter((day): day is DayDraft => day !== null).length;
}

/** 生成连续日期列表，供编排层与模板共用 */
export function datesForPlan(durationDays: number, departDate: string): string[] {
  return buildDateRange(departDate, durationDays);
}
