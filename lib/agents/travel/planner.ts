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

import { describeError } from "./amadeus";
import { createLiveQuoteProvider } from "./liveQuoteProvider";
import { compareIntercityOptions } from "./intercityOptions";
import { isRollingGoConfigured } from "./rollinggo";
import { isVariflightConfigured } from "./variflight";
import { enrichItinerary, haversineMeters, isAmapConfigured, resolveCityPoint } from "./amap";
import { buildBudgetPlan } from "./budget";
import { resolveTripCities } from "./cities";
import { computeFingerprint } from "./data";
import { isPeakSeason, resolveDuration, today } from "./date";
import {
  buildTemplateDraft,
  countGeneratedDays,
  datesForPlan,
  fillMissingDays,
  finalizeItinerary,
  parseItineraryDraft,
  repriceItinerary,
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
import type { BudgetPlan, TravelPlan, TravelQuotes, TripQuery } from "./types";
import { normalizeTripQuery } from "./validation";
import { fetchTravelWeather } from "./weather";

/**
 * 模型最大输出 token。
 *
 * 实测一份 5 天行程的 JSON 约 9300 字符（≈4600 token），已超过 4000，
 * 长行程更容易被截断成非法 JSON。这里放宽到 8000，给 15 天以上的行程
 * 也留出余量；真正的兜底仍是「截断即改用模板」，不会让用户拿到半份行程。
 */
const MAX_TOKENS = 8000;

/** 生成过程告警 */
export interface GeneratePlanResult {
  plan: TravelPlan;
  warnings: string[];
  /** 需求指纹，供接口层做去重落库 */
  fingerprint: string;
}

/**
 * 进度阶段标识。
 * 前端据此显示「正在进行哪一步」，避免用户在 40-60 秒里干等。
 */
export type PlanProgressStage =
  | "validate"
  | "quotes"
  | "itinerary"
  | "map"
  | "layout"
  | "weather"
  | "save";

/** 进度回调；不传则不产生任何开销 */
export type PlanProgressReporter = (stage: PlanProgressStage, message: string) => void;

/** 空实现，供默认参数使用 */
function noopProgress(): void {
  // 无进度上报时不做任何事
}

/**
 * 选择报价 Provider。
 *
 * 优先级：
 *   1. 组合 Provider —— 飞常准（机票）+ RollingGo（酒店），
 *      任一实时源已配置即启用，两者各自独立降级
 *   2. 纯估算       —— 两个实时源都未配置时的兜底
 *
 * 不再使用 Amadeus：其自助服务门户已于 2026-07 关闭，
 * 新开发者无免费额度且仅限企业合作，而组合 Provider 已覆盖机票与酒店。
 */
function selectProvider(warnings: string[]): QuoteProvider {
  const hasVariflight = isVariflightConfigured();
  const hasRollingGo = isRollingGoConfigured();

  if (hasVariflight || hasRollingGo) {
    if (!hasVariflight) {
      warnings.push("未配置 VARIFLIGHT_API_KEY，机票将按航线距离估算");
    }

    if (!hasRollingGo) {
      warnings.push("未配置 ROLLINGGO_API_KEY，酒店将按目的地档位估算");
    }

    return createLiveQuoteProvider();
  }

  warnings.push(
    "未配置 VARIFLIGHT_API_KEY 与 ROLLINGGO_API_KEY，当前为估算模式；" +
      "配置后自动切换为实时报价（机票用飞常准，酒店用 RollingGo）",
  );

  return createEstimateProvider();
}

/**
 * 高德地图覆盖范围：仅中国大陆、香港、澳门。
 *
 * 判断依据是内置城市表里该城市对应的 IATA 城市码。台湾（TPE/KHH）
 * 与所有境外城市一样走「无地图数据」分支，避免做一次必然失败的
 * 地理编码请求，也避免给出误导性的告警。
 */
const AMAP_COVERED_CITY_CODES = new Set([
  "BJS", "SHA", "CAN", "SZX", "CTU", "CKG", "HGH", "NKG", "WUH", "XIY",
  "CSX", "KMG", "XMN", "TAO", "TSN", "CGO", "SYX", "HAK", "LXA", "URC",
  "HRB", "SHE", "DLC", "TNA", "FOC", "NNG", "KWE", "LJG", "DLU", "ZAT",
  "JHG", "HET", "INC", "XNN", "LHW", "TYN", "SJW", "HFE", "NGB", "WNZ",
  "SWA", "ZUH", "HKG", "MFM",
]);

/** 目的地是否在高德覆盖范围内 */
export function isAmapCoveredDestination(cityCode: string): boolean {
  return AMAP_COVERED_CITY_CODES.has(cityCode.toUpperCase());
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
  onProgress: PlanProgressReporter = noopProgress,
): Promise<GeneratePlanResult> {
  // ---------- 1. 校验 ----------
  onProgress("validate", "正在校验行程参数");

  const { query, warnings: validationWarnings } = normalizeTripQuery(input);

  // 需求指纹：与数据层落库时使用同一算法，保证「生成」与「去重」判定一致
  const fingerprint = computeFingerprint(query);

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

  onProgress("quotes", "正在查询交通与住宿价格");

  const quotes = await fetchQuotesWithFallback(provider, quoteContext, warnings);

  // 跨城方案对比：火车与自驾。失败不影响主流程，仅记录告警。
  onProgress("quotes", "正在对比火车与自驾方案");

  const intercity = await compareIntercityOptions({
    originCity: query.origin,
    destinationCity: query.destination,
    departDate: query.departDate,
    party: query.party,
    style: query.style,
  });

  warnings.push(...intercity.warnings);

  // ---------- 4. 预算分配 ----------
  // 市内打车费要等地图阶段才知道，因此预算先按长途交通算，
  // 地图增强后再用真实打车费修正（见 applyMapEnrichment 之后的修正步骤）。
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
    // 跨城方式对比结果：交通科目据此计价，而不是一律按机票
    intercityOptions: intercity.options,
  });

  // ---------- 5. 行程编排 ----------
  const dates = datesForPlan(duration.days, query.departDate);

  const base: TravelPlan = {
    query,
    duration,
    quotes,
    budget,
    intercityOptions: intercity.options,
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

  onProgress("itinerary", "AI 正在编排逐日行程");

  const { draft, generatedByAI, model } = await composeItinerary(base, dates, template, warnings);

  base.itinerary = finalizeItinerary(draft.days, budget, dates, query);
  base.overview = draft.overview;
  base.checklist = draft.checklist;
  base.tips = draft.tips;
  base.generatedByAI = generatedByAI;
  base.model = model;

  // ---------- 6. 地图增强（可选）----------
  // 用高德补齐坐标、通勤与天气。任一步失败都只影响增强项，
  // 方案本身照常返回——地图是加分项，不是前置条件。
  onProgress("map", "正在获取景点坐标与真实通勤");

  await applyMapEnrichment(base, destination.input, warnings, destination.code);

  logEnrichmentCounts(base, "地图阶段后");

  // ---------- 6.5 用真实打车费修正交通科目 ----------
  // 预算在询价后就算好了，而市内打车费要到地图阶段才知道。
  // 这里重算一次预算，把打车费计入「交通」，避免它全落在「备用金」里。
  //
  // 关键：重算预算后必须**重新回填逐日活动金额**。
  // 打车费会挤占餐饮与门票的弹性额度，若不重填，
  // 活动金额基于旧预算、审计基于新预算，会报「逐日合计超出预算」。
  if ((base.mapTaxiCost ?? 0) > 0) {
    const taxiCost = base.mapTaxiCost ?? 0;

    base.budget = buildBudgetPlan({
      total: query.budget,
      party: query.party,
      nights: duration.nights,
      days: duration.days,
      style: query.style,
      flight: quotes.flight,
      hotel: quotes.hotel,
      rooms,
      peakSeason: quoteContext.peakSeason,
      taxiCost,
      // 重算时必须带上，否则交通科目会退回按机票计价
      intercityOptions: base.intercityOptions,
    });

    base.itinerary = repriceItinerary(base.itinerary, base.budget);
    base.mapTaxiCost = taxiCost;

    warnings.push(`已把市内打车约 ${taxiCost} 元计入交通科目（按里程估算）`);
  }

  // ---------- 7. 跨区通勤检查与一次重排 ----------
  // 模型不掌握真实距离，容易把相隔几十公里的两个片区排进同一天。
  // 拿到真实通勤数据后校验一次，超标就带着具体问题回炉重生成。
  const violations = findLayoutIssues(base);

  if (violations.length > 0) {
    onProgress("layout", `发现 ${violations.length} 处跨区安排，正在重新编排`);

    await retryForLongCommutes({
      plan: base,
      violations,
      template,
      dates,
      budget,
      query,
      destinationCode: destination.code,
      warnings,
    });

    logEnrichmentCounts(base, "重排后");
  }
  // ---------- 8. 自校验 ----------
  logEnrichmentCounts(base, "返回前");
  base.warnings = [...warnings, ...auditPlan(base)];

  return { plan: base, warnings: base.warnings, fingerprint };
}

/** 单段通勤允许的上限（分钟） */
const MAX_COMMUTE_MINUTES = 60;

/** 一天之内活动点位的最大离散半径（公里），超出说明跨区了 */
const MAX_DAY_RADIUS_KM = 30;

/**
 * 打印行程增强的计数快照。
 *
 * 保留这段日志是因为踩过一次教训：重算预算时误用模型原始草稿重建行程，
 * 把地图增强结果整份抹掉，症状是「有打车费、却没有坐标与通勤」。
 * 三个阶段各打一次，一旦坐标与打车费不再同步变化，从日志就能一眼看出
 * 是在哪一步丢的。
 *
 * 字段：activities 活动数、withCoords 已定位数、legs 通勤段数、
 * taxi 打车费、enriched 是否增强过。
 */
function logEnrichmentCounts(plan: TravelPlan, label: string): void {
  const activities = plan.itinerary.flatMap((day) => day.activities);
  const legs = plan.itinerary.flatMap((day) => day.commuteLegs ?? []);

  console.info(`[travel] ${label}`, {
    activities: activities.length,
    withCoords: activities.filter((item) => item.coordinates).length,
    legs: legs.length,
    taxi: plan.mapTaxiCost ?? 0,
    enriched: plan.mapEnriched ?? false,
  });
}

/**
 * 找出「通勤过长」与「当天跨区」两类问题，返回可直接喂给模型的说明。
 *
 * 两个信号互补：
 *   - 通勤段超限：相邻两点之间实际太远
 *   - 当天跨区：把某个活动点与其余点的中心比较，识别「大部分在市区、
 *     唯独一个在几十公里外」这种模型不易自查的情况
 */
function findLayoutIssues(plan: TravelPlan): string[] {
  const issues: string[] = [];

  for (const day of plan.itinerary) {
    for (const leg of day.commuteLegs ?? []) {
      if (leg.durationMinutes > MAX_COMMUTE_MINUTES) {
        issues.push(
          `第 ${day.day} 天「${leg.from} → ${leg.to}」实际通勤 ${leg.durationMinutes} 分钟（${(
            leg.distanceMeters / 1000
          ).toFixed(1)} 公里），超过 ${MAX_COMMUTE_MINUTES} 分钟上限`,
        );
      }
    }

    // 当天点位离散度：用坐标的中位数作为中心，避免被单个离群点带偏
    const points = day.activities
      .map((activity) => activity.coordinates)
      .filter((value): value is string => Boolean(value))
      .map((value) => {
        const [lng, lat] = value.split(",").map(Number);

        return { lng, lat };
      })
      .filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat));

    if (points.length < 3) {
      continue;
    }

    const centerLng = median(points.map((p) => p.lng));
    const centerLat = median(points.map((p) => p.lat));
    const center = `${centerLng},${centerLat}`;

    for (let index = 0; index < points.length; index++) {
      const activity = day.activities.filter((a) => a.coordinates)[index];

      if (!activity) {
        continue;
      }

      const distance = haversineMeters(center, `${points[index].lng},${points[index].lat}`);

      if (distance !== null && distance > MAX_DAY_RADIUS_KM * 1000) {
        issues.push(
          `第 ${day.day} 天「${activity.location ?? activity.title}」距离当日其他活动约 ${(
            distance / 1000
          ).toFixed(0)} 公里，明显不在同一片区`,
        );
      }
    }
  }

  return issues;
}

/** 取中位数 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 因通勤过长重生成一次行程。
 *
 * 只在还能调用模型、且确实拿到通勤数据时才重试；重试仍不达标就保留
 * 结果并在告警中如实说明，不会无限循环。
 */
async function retryForLongCommutes(options: {
  plan: TravelPlan;
  violations: string[];
  template: TemplateDraft;
  dates: string[];
  budget: BudgetPlan;
  query: TripQuery;
  destinationCode: string;
  warnings: string[];
}): Promise<void> {
  const { plan, violations, template, dates, budget, query, destinationCode, warnings } = options;

  if (!isTravelAIEnabled()) {
    warnings.push(...violations);

    return;
  }

  warnings.push(
    `首次行程存在 ${violations.length} 处行程布局问题，已尝试重新编排：${violations[0]}`,
  );

  const retryHint = [
    "上一次生成的行程存在跨区问题，实测通勤时间过长：",
    ...violations.map((item) => `- ${item}`),
    "",
    "请重新编排，确保：",
    "1. 每一天的所有活动都在同一个片区，任意两点的车程不超过 60 分钟；",
    "2. 安排了远郊景点的当天，其余活动都留在该景区附近；",
    "3. 相邻两天尽量住在同一片区，避免每天横穿城市。",
  ].join("\n");

  try {
    const retryResult = await composeItinerary(plan, dates, template, [], retryHint);

    if (!retryResult.generatedByAI) {
      return;
    }

    const retriedItinerary = finalizeItinerary(retryResult.draft.days, budget, dates, query);

    // 用重排结果重新做地图增强，才能比较通勤是否真的改善
    const probe: TravelPlan = {
      ...plan,
      itinerary: retriedItinerary,
      weather: undefined,
      mapEnriched: undefined,
    };

    const mapWarnings: string[] = [];
    await applyMapEnrichment(probe, query.destination, mapWarnings, destinationCode);

    const remaining = findLayoutIssues(probe);

    if (remaining.length < violations.length) {
      plan.itinerary = probe.itinerary;
      plan.overview = retryResult.draft.overview || plan.overview;
      plan.checklist = retryResult.draft.checklist.length > 0 ? retryResult.draft.checklist : plan.checklist;
      plan.tips = retryResult.draft.tips.length > 0 ? retryResult.draft.tips : plan.tips;
      plan.model = retryResult.model;
      plan.weather = probe.weather;
      plan.mapEnriched = probe.mapEnriched;

      warnings.push(`已重新编排，布局问题从 ${violations.length} 处减少到 ${remaining.length} 处`);
    } else {
      warnings.push("重新编排后仍有跨区或过长通勤，建议手动把当天的活动集中在同一片区");
    }
  } catch (error) {
    warnings.push(`重新编排失败，保留原方案：${describeError(error)}`);
  }
}

/**
 * 用地图数据增强行程：坐标、通勤、天气。
 *
 * 分三种情况处理：
 *   1. 未配高德 Key        → 只尝试天气，并提示可配置
 *   2. 目的地在中国境内     → 高德完整增强（坐标 + 通勤）+ 天气
 *   3. 目的地在境外         → 跳过坐标与通勤（高德无数据），仅取天气
 *
 * 地图与天气都是加分项：任何一步失败都不影响方案本身。
 */
async function applyMapEnrichment(
  plan: TravelPlan,
  city: string,
  warnings: string[],
  cityCode: string,
): Promise<void> {
  if (!isAmapConfigured()) {
    warnings.push("未配置 AMAP_WEB_KEY，行程未附地图坐标与通勤信息；配置后自动补齐");

    await attachWeather(plan, null, warnings);

    return;
  }

  const covered = isAmapCoveredDestination(cityCode);

  // 目的地中心坐标：境外行程也要用它来查天气
  let cityCenter: string | null = null;
  let adcode: string | undefined;

  try {
    const point = await resolveCityPoint(city);

    cityCenter = point?.location ?? null;
    adcode = point?.adcode || undefined;
  } catch {
    cityCenter = null;
  }

  if (!covered) {
    warnings.push(
      `目的地「${city}」不在高德地图覆盖范围内（仅中国大陆/香港/澳门），` +
        "本次未附景点坐标与通勤时间；当地通勤请以导航软件实测为准",
    );

    await attachWeather(plan, cityCenter, warnings, adcode);

    return;
  }

  try {
    const result = await enrichItinerary({ city, itinerary: plan.itinerary });

    plan.itinerary = result.itinerary;
    plan.mapEnriched = true;
    plan.mapTaxiCost = result.taxiCost;

    warnings.push(...result.warnings);

    // 天气优先用高德返回的 adcode；取不到时退回城市中心坐标
    await attachWeather(plan, result.cityCenter ?? cityCenter, warnings, result.adcode || adcode);
  } catch (error) {
    warnings.push(`地图数据获取失败，行程未附通勤信息：${describeError(error)}`);

    await attachWeather(plan, cityCenter, warnings, adcode);
  }
}

/**
 * 附加逐日天气。
 *
 * 只保留真正落在行程日期内的预报——把出发前几天的天气混进行程里
 * 比不显示更糟。没有任何一天匹配时明确说明原因。
 */
/**
 * 附加逐日天气。
 *
 * 只保留真正落在行程日期内的预报——把出发前几天的天气混进行程里
 * 比不显示更糟。没有任何一天匹配时明确说明原因。
 *
 * @param location "lng,lat"，和风天气用它定位
 * @param adcode   高德 adcode，高德天气用它定位
 */
async function attachWeather(
  plan: TravelPlan,
  location: string | null,
  warnings: string[],
  adcode?: string,
): Promise<void> {
  const result = await fetchTravelWeather(location, adcode);

  if (result.warning) {
    warnings.push(result.warning);
  }

  if (result.days.length === 0) {
    return;
  }

  const tripDates = new Set(plan.itinerary.map((day) => day.date));
  const covered = result.days.filter((item) => tripDates.has(item.date));

  if (covered.length > 0) {
    plan.weather = covered;
  } else {
    warnings.push(
      `行程日期（${plan.query.departDate} 起）超出天气预报范围（${result.source} 仅提供近期预报），未附天气信息`,
    );
  }
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
  retryHint?: string,
): Promise<{ draft: ItineraryDraft; generatedByAI: boolean; model?: string }> {
  if (!isTravelAIEnabled()) {
    warnings.push("未配置 DEEPSEEK_API_KEY，行程内容由内置模板生成");

    return { draft: template, generatedByAI: false };
  }

  const model = getTravelAIModel();

  const baseUser = buildUserPrompt(plan, dates);

  // 重排时把「上一次哪里不通顺」直接写进提示词，比笼统要求有效得多
  const user = retryHint ? `${baseUser}\n\n## 重排要求\n${retryHint}` : baseUser;

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
