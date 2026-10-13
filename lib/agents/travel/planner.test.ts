import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildBudgetPlan } from "./budget";
import { addDays, today } from "./date";
import { buildTemplateDraft, finalizeItinerary } from "./itinerary";
import { auditPlan, previewQuery } from "./planner";
import { estimateHotelQuote, type QuoteContext } from "./providers";
import { TravelValidationError } from "./validation";
import type { ItineraryDay, TravelPlan, TripQuery } from "./types";

/**
 * 日期一律相对今天计算，避免用例随时间推移而失效
 * （校验规则里有「去程不能是过去」这一条）。
 */
const BASE_DATE = addDays(today(), 7)!;

const DATES = [0, 1, 2, 3, 4].map((offset) => addDays(BASE_DATE, offset)!);

/** 构造查询 */
function makeQuery(overrides: Partial<TripQuery> = {}): TripQuery {
  return {
    origin: "北京",
    destination: "东京",
    departDate: DATES[0],
    returnDate: DATES[DATES.length - 1],
    party: { adults: 2, children: 0 },
    budget: 12000,
    style: "comfort",
    interests: [],
    ...overrides,
  };
}

/** 构造一份住宿报价上下文 */
function makeQuoteContext(query: TripQuery): QuoteContext {
  return {
    originCity: query.origin,
    destinationCity: query.destination,
    originCode: "BJS",
    destinationCode: "TYO",
    departDate: query.departDate,
    returnDate: query.returnDate,
    nights: 4,
    party: query.party,
    style: query.style,
    rooms: 1,
    peakSeason: false,
  };
}

/** 构造一天行程 */
function makeDay(date: string, cost: number, day: number): ItineraryDay {
  return {
    day,
    date,
    theme: "主题",
    activities: [
      {
        startTime: "09:00",
        endTime: "11:00",
        title: "活动",
        kind: "sight",
        description: "说明",
        estimatedCost: cost,
        costSource: "estimate",
      },
    ],
    estimatedCost: cost,
    accommodation: "酒店",
  };
}

/** 构造一份自洽的方案 */
function makePlan(overrides: Partial<TravelPlan> = {}): TravelPlan {
  const query = overrides.query ?? makeQuery();

  const budget =
    overrides.budget ??
    buildBudgetPlan({
      total: query.budget,
      party: query.party,
      nights: 4,
      days: 5,
      style: query.style,
      flight: null,
      hotel: null,
      rooms: 1,
      peakSeason: false,
    });

  const activityBudget = budget.categories
    .filter((item) => item.key === "activities" || item.key === "food")
    .reduce((acc, item) => acc + item.amount, 0);

  // 把餐饮与门票预算均分到 5 天，保证自校验通过
  const perDay = Math.floor(activityBudget / DATES.length);

  const itinerary =
    overrides.itinerary ??
    DATES.map((date, index) =>
      makeDay(date, index === DATES.length - 1 ? activityBudget - perDay * 4 : perDay, index + 1),
    );

  // 默认带一份住宿报价：否则 auditPlan 会（正确地）报告「有住宿晚数却无住宿报价」
  const quotes = overrides.quotes ?? {
    flight: null,
    hotel: estimateHotelQuote(makeQuoteContext(query)),
    warnings: [],
  };

  return {
    query,
    duration: { nights: 4, days: 5 },
    quotes,
    budget,
    overview: "总览",
    itinerary,
    checklist: ["清单"],
    tips: ["提示"],
    generatedByAI: false,
    generatedAt: "2026-09-01T00:00:00.000Z",
    warnings: [],
    ...overrides,
  };
}

describe("travel/planner auditPlan 自校验", () => {
  it("自洽的方案不报问题", () => {
    assert.deepEqual(auditPlan(makePlan()), []);
  });

  it("计入打车费后逐日金额必须随预算重算，否则会报超出", () => {
    // 复现真实场景：预算先按长途交通算好并回填行程，
    // 之后才知道打车费、重算预算。若不重填行程金额，
    // 活动金额基于旧预算、审计基于新预算，必然超限。
    const query = makeQuery();

    const withoutTaxi = buildBudgetPlan({
      total: query.budget,
      party: query.party,
      nights: 4,
      days: 5,
      style: query.style,
      flight: null,
      hotel: null,
      rooms: 1,
      peakSeason: false,
    });

    const withTaxi = buildBudgetPlan({
      total: query.budget,
      party: query.party,
      nights: 4,
      days: 5,
      style: query.style,
      flight: null,
      hotel: null,
      rooms: 1,
      peakSeason: false,
      taxiCost: 176,
    });

    const activityBudgetOf = (plan: typeof withoutTaxi) =>
      plan.categories
        .filter((item) => item.key === "activities" || item.key === "food")
        .reduce((acc, item) => acc + item.amount, 0);

    // 打车费确实挤占了弹性科目，两个预算的餐饮+门票额度不同
    assert.notEqual(activityBudgetOf(withoutTaxi), activityBudgetOf(withTaxi));

    // 用新预算重算行程后，审计不应报「超出」
    const template = buildTemplateDraft(
      query,
      { quotes: { flight: null, hotel: null, warnings: [] }, budget: withTaxi },
      DATES,
    );

    const itinerary = finalizeItinerary(template.days, withTaxi, DATES, query);

    const plan = makePlan({ budget: withTaxi, itinerary });
    const issues = auditPlan(plan);

    assert.equal(
      issues.some((item) => item.includes("超出")),
      false,
      `重算后不应报超出：${issues.join("；")}`,
    );
  });

  it("行程天数与计划天数不一致时报错", () => {
    const plan = makePlan({ itinerary: [makeDay(DATES[0], 100, 1)] });
    const issues = auditPlan(plan);

    assert.ok(issues.some((item) => item.includes("不一致")));
  });

  it("预算分项合计与总预算不符时报错", () => {
    const plan = makePlan();
    // 人为破坏一个科目金额，模拟上游算错
    plan.budget.categories[0].amount += 500;

    const issues = auditPlan(plan);

    assert.ok(issues.some((item) => item.includes("合计")));
  });

  it("每日花费超出餐饮与门票预算时报错", () => {
    const plan = makePlan({
      itinerary: DATES.map((date, index) => makeDay(date, 999999, index + 1)),
    });

    const issues = auditPlan(plan);

    assert.ok(issues.some((item) => item.includes("超出")));
  });

  it("日期顺序异常时报错", () => {
    const reversed = [...DATES].reverse();

    const plan = makePlan({
      itinerary: reversed.map((date, index) => makeDay(date, 10, index + 1)),
    });

    const issues = auditPlan(plan);

    assert.ok(issues.some((item) => item.includes("顺序")));
  });

  it("有住宿晚数却无住宿报价时提示", () => {
    // 显式清空住宿报价，验证告警逻辑生效
    const plan = makePlan({ quotes: { flight: null, hotel: null, warnings: [] } });
    const issues = auditPlan(plan);

    assert.ok(issues.some((item) => item.includes("住宿报价")));
  });
});

describe("travel/planner previewQuery 预检", () => {
  it("合法输入返回规范化结果", () => {
    const { query } = previewQuery({
      origin: "北京",
      destination: "东京",
      departDate: DATES[0],
      returnDate: DATES[DATES.length - 1],
      party: { adults: 1, children: 0 },
      budget: 8000,
      style: "comfort",
    });

    assert.equal(query.origin, "北京");
    assert.equal(query.budget, 8000);
  });

  it("非法输入抛出校验错误", () => {
    assert.throws(() => previewQuery({}), TravelValidationError);
  });
});
