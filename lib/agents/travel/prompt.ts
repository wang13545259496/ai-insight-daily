/**
 * 行程编排的 Prompt 构建。
 *
 * 核心约束：把「已经算好的钱」作为不可变输入交给模型，并要求它
 * 只输出结构与内容（哪天去哪、吃什么、怎么走），不要输出任何
 * 金额计算。这样即使模型算数不准，也不会污染预算结果。
 */

import { getCategoryLabels, getStylePreset } from "./budget";
import type { BudgetPlan, TravelPlan } from "./types";

/** 模型要求的输出结构说明（与解析层的宽校验对应） */
const OUTPUT_CONTRACT = `{
  "overview": "整体行程总览，150-250字，说明节奏安排、亮点与取舍理由",
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "theme": "当日主题，10字以内",
      "accommodation": "当晚住宿安排说明",
      "tips": "当日实用提示",
      "activities": [
        {
          "startTime": "09:00",
          "endTime": "11:30",
          "title": "活动名称",
          "kind": "sight",
          "location": "地点或交通方式",
          "description": "40-80字说明，含实用信息",
          "weight": 1.5
        }
      ]
    }
  ],
  "checklist": ["行前准备事项，6-10条"],
  "tips": ["出行提示，4-8条，含交通、季节、安全、礼仪等"]
}`;

/** 活动类型枚举，供模型选择 */
const ACTIVITY_KINDS = "sight（景点）、meal（餐饮）、transport（交通）、experience（体验项目）、rest（休息）";

/**
 * 构建系统提示词。
 * 强调三件事：天数必须精确、金额不要计算、内容要可执行。
 */
export function buildSystemPrompt(): string {
  return [
    "你是一位资深中文旅行规划师，擅长把预算约束转化为可执行的逐日行程。",
    "",
    "严格遵守以下规则：",
    "1. 天数必须与给定的日期列表完全一致，不多不少，逐日输出。",
    "2. 每个活动给出 weight（相对权重，正数，约 0.5-3），表示该活动在门票体验预算中的占比。",
    "   绝对不要自己计算或输出任何金额、总价、人均花费——所有金额由系统按 weight 计算。",
    "3. 活动要具体可执行：真实存在的景点/餐厅/街区名称，给出开放时间或交通方式等实用信息。",
    "4. 地域上要顺路：同一天的活动集中在相邻区域，避免来回穿城。",
    "5. 节奏要合理：每天安排 3-5 个活动，留出用餐与休息时间，避免堆砌。",
    "6. 尊重用户给出的预算档位与偏好；若预算紧张，优先保证交通与住宿，压缩购物与高价项目。",
    "7. 只输出一个 JSON 对象，不要输出 markdown 代码围栏，不要输出任何解释文字。",
    "",
    `活动类型 kind 只能取：${ACTIVITY_KINDS}`,
    "",
    "输出结构：",
    OUTPUT_CONTRACT,
  ].join("\n");
}

/** 把预算科目压缩成一行行可读文本，便于模型理解约束 */
function describeBudget(budget: BudgetPlan): string {
  const labels = getCategoryLabels();

  const lines = budget.categories.map((category) => {
    const locked = category.lockedByQuote ? "（已由实时报价锁定）" : "";

    return `- ${labels[category.key]}：${category.amount} 元，占 ${Math.round(
      category.ratio * 100,
    )}%${locked}。${category.detail}`;
  });

  lines.push(
    `- 合计：${budget.allocated} 元（人均 ${budget.perPerson} 元，人均每日 ${budget.perPersonPerDay} 元）`,
  );

  if (!budget.feasible) {
    lines.push(
      `- 注意：当前预算低于最低可行成本约 ${budget.minimumViable} 元，请在行程中明确给出省钱取舍建议`,
    );
  }

  return lines.join("\n");
}

/** 汇总报价信息，供模型参考交通与住宿的实际安排 */
function describeQuotes(plan: Pick<TravelPlan, "quotes">): string {
  const { flight, hotel } = plan.quotes;
  const lines: string[] = [];

  if (flight) {
    const outbound = flight.outbound[0];
    const inbound = flight.inbound[0];

    lines.push(
      `- 机票：${outbound?.from ?? "?"} → ${outbound?.to ?? "?"}，去程 ${
        outbound?.departAt ?? "待定"
      }，返程 ${inbound?.departAt ?? "待定"}，单人 ${flight.pricePerAdult} 元，${
        flight.confidence === "live" ? "真实报价" : "估算值"
      }`,
    );
  } else {
    lines.push("- 机票：未取得报价，请按常规航班时刻安排首日与末日行程");
  }

  if (hotel) {
    lines.push(
      `- 住宿：${hotel.name}，${hotel.rooms} 间，${hotel.pricePerNight} 元/晚，${
        hotel.confidence === "live" ? "真实报价" : "估算值"
      }`,
    );
  } else if (plan.quotes.warnings.length === 0) {
    lines.push("- 住宿：无需住宿");
  }

  return lines.join("\n");
}

/**
 * 构建用户提示词：把行程事实、预算、日期清单一次性给全。
 * dates 由调用方传入，保证与校验后的天数一致。
 */
export function buildUserPrompt(plan: TravelPlan, dates: string[]): string {
  const { query, duration, budget, quotes } = plan;
  const preset = getStylePreset(query.style);
  const headcount = query.party.adults + query.party.children;

  const sections: string[] = [];

  sections.push(
    [
      "## 行程基本信息",
      `- 出发地：${query.origin}`,
      `- 目的地：${query.destination}`,
      `- 去程日期：${query.departDate}`,
      `- 返程日期：${query.returnDate}`,
      `- 行程天数：${duration.days} 天 ${duration.nights} 晚`,
      `- 同行人数：成人 ${query.party.adults} 人${
        query.party.children > 0 ? `，儿童 ${query.party.children} 人` : ""
      }（共 ${headcount} 人）`,
      `- 预算档位：${preset.label}（住宿标准：${preset.hotelGrade}）`,
    ].join("\n"),
  );

  if (query.interests.length > 0) {
    sections.push(`## 用户偏好\n请优先安排与这些主题相关的活动：${query.interests.join("、")}`);
  }

  if (query.notes) {
    sections.push(`## 用户补充要求\n${query.notes}`);
  }

  sections.push(`## 预算约束（金额已确定，不要重新计算）\n${describeBudget(budget)}`);

  sections.push(`## 交通与住宿\n${describeQuotes(plan)}`);

  if (quotes.warnings.length > 0) {
    sections.push(`## 询价提示\n${quotes.warnings.map((item) => `- ${item}`).join("\n")}`);
  }

  sections.push(
    [
      "## 需要输出的日期清单",
      `必须输出恰好 ${dates.length} 天，day 从 1 递增，date 必须与下面一一对应：`,
      dates.map((date, index) => `第 ${index + 1} 天：${date}`).join("\n"),
    ].join("\n"),
  );

  sections.push(
    "## 任务\n请为上述行程输出逐日安排。记住：只输出 JSON，不要输出金额计算，活动用 weight 表示相对花费权重。",
  );

  return sections.join("\n\n");
}
