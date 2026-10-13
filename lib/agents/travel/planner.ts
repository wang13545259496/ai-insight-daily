/**
 * 旅行方案生成主流程。
 *
 * 流程分工（这是本功能可信度的关键）：
 *   1. 校验输入        → lib/travel/validation.ts   确定性代码
 *   2. 解析城市三字码  → lib/travel/cities.ts       确定性代码
 *   3. 询价（真实/估算）→ lib/travel/providers.ts    外部接口 + 降级
 *   4. 预算分配        → lib/travel/budget.ts       确定性代码（模型不参与）
 *   5. 行程内容编排    → LLM                         只输出结构，不算钱
 *   6. 完整性自校验    → 本文件                       兜底修数
 *
 * 任何一步失败都不会让整个请求失败：报价失败转估算，模型失败转模板。
 */

import { getTravelAIModel, isTravelAIEnabled, travelChat } from "./ai";

import { isAmadeusConfigured, createAmadeusProvider, describeError } from "./amadeus";
import { buildBudgetPlan } from "./budget";
import { resolveTripCities } from "./cities";
import { isPeakSeason, resolveDuration, today } from "./date";
import {
  buildTemplateDraft,
  countGeneratedDays,
  datesForPlan,
  fillMissingDays,
  finalizeItinerary,
  parseItineraryDraft,
  type ItineraryDraft,
  type TemplateDraft,
} from "./itinerary";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import {
  createEstimateProvider,
  estimateFlightQuote,
  estimateHotelQuote,
  resolveRoomCount,
  type QuoteContext,
  type QuoteProvider,
} from "./providers";
import type { TravelPlan, TravelQuotes } from "./types";
import { normalizeTripQuery } from "./validation";

/**
 * 模型最大输出 token。
 *
 * 实测一份 5 天行程的 JSON 约 9300 字符（≈4600 token），已超过 4000，
 * 长行程更容易被截断成非法 JSON。这里放宽到 8000，给 15 天以上的行程
 * 也留出余量；真正的兜底仍是「截断即改用模板」，不会让用户拿到半份行程。
 */
const MAX_TOKENS = 8000;

/** 生成结果：方案本体 + 生成过程告警 */
export interface GeneratePlanResult {
  plan: TravelPlan;
  warnings: string[];
}

/**
 * 选择报价 Provider。
 * 配了 Amadeus 凭据就走真实询价，否则走估算兜底。
 */
function selectProvider(warnings: string[]): QuoteProvider {
  if (isAmadeusConfigured()) {
    return createAmadeusProvider();
  }

  warnings.push(
    "未配置 AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET，当前为估算模式；配置后自动切换为实时询价",
  );

  return createEstimateProvider();
}

/**
 * 主入口：由不可信输入生成完整旅行方案。
 *
 * @throws TravelValidationError 输入非法
 * @throws CityResolveError 城市无法识别
 */
export async function generateTravelPlan(
  input: unknown,
  now: Date = new Date(),
): Promise<GeneratePlanResult> {
  // ---------- 1. 校验 ----------
  const { query, warnings: validationWarnings } = normalizeTripQuery(input);

  const duration = resolveDuration(query.departDate, query.returnDate);

  if (!duration) {
    // normalizeTripQuery 已覆盖日期非法的情况，这里是防御性兜底
    throw new Error("无法解析行程天数");
  }

  const warnings: string[] = [...validationWarnings];

  // ---------- 2. 城市解析 ----------
  const { origin, destination } = resolveTripCities(query.origin, query.destination);

  // ---------- 3. 询价 ----------
  const rooms = resolveRoomCount(query.party);

  const quoteContext: QuoteContext = {
    originCity: origin.input,
    destinationCity: destination.input,
    originCode: origin.code,
    destinationCode: destination.code,
    departDate: query.departDate,
    returnDate: query.returnDate,
    nights: duration.nights,
    party: query.party,
    style: query.style,
    rooms,
    peakSeason: isPeakSeason(query.departDate),
  };

  const provider = selectProvider(warnings);
  const quotes = await fetchQuotesWithFallback(provider, quoteContext, warnings);

  // ---------- 4. 预算分配 ----------
  const budget = buildBudgetPlan({
    total: query.budget,
    party: query.party,
    nights: duration.nights,
    days: duration.days,
    style: query.style,
    flight: quotes.flight,
    hotel: quotes.hotel,
    rooms,
    peakSeason: quoteContext.peakSeason,
  });

  // ---------- 5. 行程编排 ----------
  const dates = datesForPlan(duration.days, query.departDate);

  const base: TravelPlan = {
    query,
    duration,
    quotes,
    budget,
    overview: "",
    itinerary: [],
    checklist: [],
    tips: [],
    generatedByAI: false,
    generatedAt: now.toISOString(),
    warnings: [],
  };

  const template = buildTemplateDraft(
    query,
    { quotes, budget },
    dates,
  );

  const { draft, generatedByAI, model } = await composeItinerary(base, dates, template, warnings);

  base.itinerary = finalizeItinerary(draft.days, budget, dates, query);
  base.overview = draft.overview;
  base.checklist = draft.checklist;
  base.tips = draft.tips;
  base.generatedByAI = generatedByAI;
  base.model = model;

  // ---------- 6. 自校验 ----------
  base.warnings = [...warnings, ...auditPlan(base)];

  return { plan: base, warnings: base.warnings };
}

/**
 * 询价并处理降级。
 * Provider 抛错时退回估算，保证「有报价最好，没报价也能出方案」。
 */
async function fetchQuotesWithFallback(
  provider: QuoteProvider,
  context: QuoteContext,
  warnings: string[],
): Promise<TravelQuotes> {
  let quotes: TravelQuotes;

  try {
    quotes = await provider.fetchQuotes(context);
  } catch (error) {
    warnings.push(`报价接口调用失败，已改用估算：${describeError(error)}`);

    quotes = { flight: null, hotel: null, warnings: [] };
  }

  warnings.push(...quotes.warnings);

  // 逐项补齐：Provider 只返回一项时，另一项用估算值，避免预算里出现 0 元交通
  const flight = quotes.flight ?? estimateFlightQuote(context);

  const hotel = context.nights > 0 ? (quotes.hotel ?? estimateHotelQuote(context)) : null;

  return { ...quotes, flight, hotel };
}

/**
 * 调用模型编排行程；模型不可用或输出不可用时用模板补齐。
 * 返回是否由模型生成，便于前端如实标注。
 */
async function composeItinerary(
  plan: TravelPlan,
  dates: string[],
  template: TemplateDraft,
  warnings: string[],
): Promise<{ draft: ItineraryDraft; generatedByAI: boolean; model?: string }> {
  if (!isTravelAIEnabled()) {
    warnings.push("未配置 DEEPSEEK_API_KEY，行程内容由内置模板生成");

    return { draft: template, generatedByAI: false };
  }

  const model = getTravelAIModel();

  const user = buildUserPrompt(plan, dates);

  // 最多尝试两次：模型偶发输出非法 JSON（多了说明文字、被截断、括号不配对），
  // 第二次附上更严格的格式要求。仍失败才改用模板。
  for (let attempt = 1; attempt <= 2; attempt++) {
    const system =
      attempt === 1
        ? buildSystemPrompt()
        : `${buildSystemPrompt()}\n\n注意：上一次输出的 JSON 无法被解析。请只输出一个完整、闭合、合法的 JSON 对象，不要输出任何解释文字或代码围栏。`;

    let text: string | null = null;

    try {
      text = await travelChat({
        system,
        user,
        temperature: attempt === 1 ? 0.6 : 0.2,
        maxTokens: MAX_TOKENS,
      });
    } catch (error) {
      warnings.push(`模型调用异常，已改用模板：${describeError(error)}`);
      break;
    }

    if (!text) {
      warnings.push(
        attempt === 1 ? "模型未返回有效内容，正在重试" : "模型仍未返回有效内容，行程由内置模板生成",
      );
      continue;
    }

    const parsed = parseItineraryDraft(text, dates);

    if (!parsed) {
      warnings.push(
        attempt === 1
          ? "模型首次输出无法解析为行程结构，正在重试"
          : "模型输出两次都无法解析为行程结构，已改用模板生成",
      );
      continue;
    }

    // 模型少给或某天解析失败时用模板补齐，保证天数是精确的
    const generatedDays = countGeneratedDays(parsed);

    if (generatedDays < dates.length) {
      warnings.push(
        `模型仅生成 ${generatedDays} 天行程，剩余 ${dates.length - generatedDays} 天由模板补齐`,
      );
    }

    return {
      draft: fillMissingDays(parsed, template, dates),
      generatedByAI: true,
      model,
    };
  }

  return { draft: template, generatedByAI: false, model };
}

/**
 * 方案完整性自校验。
 *
 * 这一步是「不信任任何上游」的体现：无论模型输出什么、接口返回什么，
 * 最终展示给用户的数字必须自洽。不自洽的地方在这里被发现并报告，
 * 而不是等用户自己发现「预算加起来不对」。
 */
export function auditPlan(plan: TravelPlan): string[] {
  const issues: string[] = [];

  const headcount = plan.query.party.adults + plan.query.party.children;

  if (headcount <= 0) {
    issues.push("同行人数异常");
  }

  // 预算合计必须等于总预算
  const sum = plan.budget.categories.reduce((acc, item) => acc + item.amount, 0);

  if (sum !== plan.budget.total) {
    issues.push(`预算各项合计 ${sum} 元与总预算 ${plan.budget.total} 元不一致，差额计入备用金`);
  }

  // 天数与行程条数必须一致
  if (plan.itinerary.length !== plan.duration.days) {
    issues.push(
      `行程天数 ${plan.itinerary.length} 与计划天数 ${plan.duration.days} 不一致，请重新生成`,
    );
  }

  // 每日花费之和不应显著超过预算中的门票餐饮合计（超出说明回填有问题）
  const dailySum = plan.itinerary.reduce((acc, day) => acc + day.estimatedCost, 0);

  const activityBudget = plan.budget.categories
    .filter((item) => item.key === "activities" || item.key === "food")
    .reduce((acc, item) => acc + item.amount, 0);

  if (dailySum > activityBudget) {
    issues.push(
      `逐日活动花费合计 ${dailySum} 元超出餐饮与门票预算 ${activityBudget} 元，建议核对`,
    );
  }

  // 行程日期不能出现重复或倒退
  const dates = plan.itinerary.map((day) => day.date);

  for (let index = 1; index < dates.length; index++) {
    if (dates[index] <= dates[index - 1]) {
      issues.push("行程日期顺序异常");
      break;
    }
  }

  // 缺少住宿报价但有多晚行程时给出提示
  if (plan.duration.nights > 0 && !plan.quotes.hotel) {
    issues.push("行程含住宿但未取得住宿报价，住宿费按估算计入");
  }

  return issues;
}

/** 便捷入口：仅校验并返回规范化后的输入，供表单预检使用 */
export function previewQuery(input: unknown) {
  return normalizeTripQuery(input);
}

/** 今天日期，供前端默认值使用 */
export function defaultDepartDate(): string {
  return today();
}
