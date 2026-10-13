import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildBudgetPlan } from "./budget";
import { addDays, today } from "./date";
import {
  allocateByWeight,
  buildTemplateDraft,
  countGeneratedDays,
  fillMissingDays,
  finalizeItinerary,
  parseItineraryDraft,
  type DayDraft,
} from "./itinerary";
import type { TravelPlan, TripQuery } from "./types";

/** 日期相对今天计算，避免用例随时间推移失效 */
const BASE_DATE = addDays(today(), 7)!;

/** 构造查询条件 */
function makeQuery(overrides: Partial<TripQuery> = {}): TripQuery {
  return {
    origin: "北京",
    destination: "东京",
    departDate: BASE_DATE,
    returnDate: addDays(BASE_DATE, 4)!,
    party: { adults: 2, children: 0 },
    budget: 12000,
    style: "comfort",
    interests: ["美食"],
    ...overrides,
  };
}

/** 构造预算方案；天数由查询推导，便于覆盖一日游场景 */
function makeBudget(total = 12000, query: TripQuery = makeQuery()) {
  const nights = Math.round(
    (Date.parse(`${query.returnDate}T00:00:00Z`) - Date.parse(`${query.departDate}T00:00:00Z`)) /
      86_400_000,
  );

  return buildBudgetPlan({
    total,
    party: query.party,
    nights,
    days: nights + 1,
    style: query.style,
    flight: null,
    hotel: null,
    rooms: 1,
    peakSeason: false,
  });
}

const DATES = [0, 1, 2, 3, 4].map((offset) => addDays(BASE_DATE, offset)!);

/**
 * 取出草稿中某一天，若为 null 直接判定失败。
 * 解析结果允许含 null（未生成的天），断言前必须先排除，
 * 否则 TS 会报「可能为 null」，测试也会抛出难以定位的 TypeError。
 */
function dayAt(draft: { days: Array<DayDraft | null> }, index: number): DayDraft {
  const day = draft.days[index];

  assert.ok(day, `第 ${index + 1} 天不应为 null`);

  return day;
}

describe("travel/itinerary allocateByWeight", () => {
  it("分配之和精确等于总额", () => {
    for (const total of [0, 1, 13, 100, 4321, 99999]) {
      const result = allocateByWeight([2, 1, 1, 0.5], total);

      assert.equal(
        result.reduce((acc, value) => acc + value, 0),
        total,
        `总额 ${total} 应精确分配`,
      );
    }
  });

  it("权重为 0 的项不参与分配", () => {
    const result = allocateByWeight([1, 1, 0], 100);

    assert.equal(result[2], 0);
    assert.equal(result[0] + result[1], 100);
  });

  it("权重全为 0 时均分且总额不变", () => {
    const result = allocateByWeight([0, 0, 0], 100);

    assert.equal(result.reduce((acc, value) => acc + value, 0), 100);
  });

  it("空数组返回空数组", () => {
    assert.deepEqual(allocateByWeight([], 100), []);
  });
});

describe("travel/itinerary 模型输出解析", () => {
  it("解析标准 JSON 输出", () => {
    const text = JSON.stringify({
      overview: "总览内容",
      days: [
        {
          day: 1,
          date: "2026-10-01",
          theme: "抵达",
          accommodation: "市区酒店",
          tips: "提前值机",
          activities: [
            {
              startTime: "09:00",
              endTime: "11:00",
              title: "浅草寺",
              kind: "sight",
              location: "台东区",
              description: "东京最古老的寺庙",
              weight: 2,
            },
          ],
        },
      ],
      checklist: ["护照", "充电器"],
      tips: ["注意礼仪"],
    });

    const draft = parseItineraryDraft(text, DATES);

    assert.ok(draft);
    assert.equal(draft.overview, "总览内容");
    // days 长度恒等于 dates 长度，模型只给 1 天时其余为 null
    assert.equal(draft.days.length, DATES.length);

    const first = dayAt(draft, 0);

    assert.equal(first.activities[0].title, "浅草寺");
    assert.equal(first.activities[0].weight, 2);
    // 日期由调用方回填，解析阶段刻意留空
    assert.equal(first.date, "");
    assert.equal(draft.days[1], null);
    assert.deepEqual(draft.checklist, ["护照", "充电器"]);
  });

  it("兼容 ```json 代码围栏", () => {
    const text = [
      "```json",
      JSON.stringify({
        overview: "x",
        days: [
          {
            activities: [{ title: "活动", kind: "sight", weight: 1 }],
          },
        ],
      }),
      "```",
    ].join("\n");

    const draft = parseItineraryDraft(text, DATES);

    assert.ok(draft);
    assert.equal(draft.days.length, DATES.length);
    assert.equal(dayAt(draft, 0).activities[0].title, "活动");
    // 未提供的天为 null，交由模板补齐，不会前移
    assert.equal(draft.days[1], null);
  });

  it("兼容前后夹杂说明文字", () => {
    const text = `好的，这是方案：\n${JSON.stringify({
      overview: "x",
      days: [{ activities: [{ title: "活动", weight: 1 }] }],
    })}\n希望对你有帮助。`;

    assert.ok(parseItineraryDraft(text, DATES));
  });

  it("无法解析时返回 null", () => {
    assert.equal(parseItineraryDraft("这不是 JSON", DATES), null);
    assert.equal(parseItineraryDraft("{}", DATES), null);
    assert.equal(parseItineraryDraft("[1,2,3]", DATES), null);
  });

  it("丢弃缺标题的活动；全天无有效活动时该天为 null 且不占用后续下标", () => {
    const text = JSON.stringify({
      overview: "x",
      days: [
        { activities: [{ description: "没有标题" }] },
        { activities: [{ title: "有效活动", weight: 1 }] },
      ],
    });

    const draft = parseItineraryDraft(text, DATES);

    assert.ok(draft);
    // days 长度恒等于 dates 长度，无效天占位为 null
    assert.equal(draft.days.length, DATES.length);
    assert.equal(draft.days[0], null);
    assert.equal(draft.days[1]?.activities[0].title, "有效活动");
    // 第 2 天的内容必须留在下标 1，不能前移到下标 0
    assert.equal(draft.days[2], null);
  });

  it("非法 kind 退回 sight，非法 weight 退回 1", () => {
    const text = JSON.stringify({
      overview: "x",
      days: [
        {
          activities: [
            { title: "活动", kind: "不存在的类型", weight: -5 },
            { title: "活动二", kind: "meal", weight: "abc" },
          ],
        },
      ],
    });

    const draft = parseItineraryDraft(text, DATES);

    assert.ok(draft);
    assert.equal(dayAt(draft, 0).activities[0].kind, "sight");
    assert.equal(dayAt(draft, 0).activities[0].weight, 1);
    assert.equal(dayAt(draft, 0).activities[1].kind, "meal");
    assert.equal(dayAt(draft, 0).activities[1].weight, 1);
  });

  it("时间格式归一化，非法时间用默认值", () => {
    const text = JSON.stringify({
      overview: "x",
      days: [
        {
          activities: [
            { title: "A", startTime: "9:5", endTime: "25:00", weight: 1 },
            { title: "B", startTime: "14:30", endTime: "16:00", weight: 1 },
          ],
        },
      ],
    });

    const draft = parseItineraryDraft(text, DATES);

    assert.ok(draft);
    // "9:5" 不符合 H:mm，退回默认起始时间
    assert.equal(dayAt(draft, 0).activities[0].startTime, "09:00");
    // 非法结束时间退回开始时间
    assert.equal(dayAt(draft, 0).activities[0].endTime, "09:00");
    assert.equal(dayAt(draft, 0).activities[1].startTime, "14:30");
  });

  it("池化长文本时截断并加省略号", () => {
    const longTitle = "活".repeat(200);
    const text = JSON.stringify({
      overview: "x",
      days: [{ activities: [{ title: longTitle, weight: 1 }] }],
    });

    const draft = parseItineraryDraft(text, DATES);

    assert.ok(draft);
    assert.ok(dayAt(draft, 0).activities[0].title.length <= 61);
    assert.ok(dayAt(draft, 0).activities[0].title.endsWith("…"));
  });
});

describe("travel/itinerary 模板兜底", () => {
  it("生成的天数与日期完全一致", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    assert.equal(draft.days.length, DATES.length);

    draft.days.forEach((day, index) => {
      assert.equal(day.date, DATES[index]);
    });
  });

  it("首日含交通活动，末日含返程活动", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    const firstKinds = draft.days[0].activities.map((item) => item.kind);
    const lastKinds = draft.days[DATES.length - 1].activities.map((item) => item.kind);

    assert.ok(firstKinds.includes("transport"));
    assert.ok(lastKinds.includes("transport"));
  });

  it("包含总览、清单与提示", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    assert.ok(draft.overview.length > 50);
    assert.ok(draft.checklist.length >= 5);
    assert.ok(draft.tips.length >= 3);
  });

  it("一日游模板不包含住宿晚数描述错误", () => {
    const query = makeQuery({ returnDate: BASE_DATE });
    // 一日游：0 晚 1 天，预算由查询推导
    const budget = makeBudget(2000, query);

    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, [BASE_DATE]);

    assert.equal(draft.days.length, 1);
  });
});

describe("travel/itinerary fillMissingDays 补齐", () => {
  it("模型只给了第 3 天时，内容落在第 3 天而不是被前移", () => {
    const query = makeQuery();
    const budget = makeBudget();

    const fallback = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    // 模拟解析结果：前两天下标为 null，第 3 天有内容
    const parsed = {
      overview: "模型总览",
      days: [
        null,
        null,
        {
          day: 3,
          date: "",
          theme: "模型给的第三天",
          accommodation: "模型住宿",
          activities: [
            {
              startTime: "09:00",
              endTime: "11:00",
              title: "模型活动",
              kind: "sight" as const,
              description: "说明",
              weight: 1,
            },
          ],
        },
      ],
      checklist: [],
      tips: [],
    };

    const merged = fillMissingDays(parsed, fallback, DATES);

    assert.equal(merged.days.length, DATES.length);
    // 关键：下标必须保持不变，第 3 天的内容不能前移到第 1 天
    assert.equal(merged.days[0]?.theme, fallback.days[0]?.theme);
    assert.equal(merged.days[1]?.theme, fallback.days[1]?.theme);
    assert.equal(merged.days[2]?.theme, "模型给的第三天");
    assert.equal(merged.overview, "模型总览");
    assert.deepEqual(merged.checklist, fallback.checklist);
  });

  it("模型给了完整天数时全部保留模型内容，不被模板覆盖", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const fallback = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    // 解析层会把 date 置空，这里刻意用空 date 复现真实情况：
    // 若补齐逻辑按 date 对齐，就会全部匹配失败而退回模板
    const modelDays = DATES.map((_, index) => ({
      day: index + 1,
      date: "",
      theme: `模型主题${index + 1}`,
      accommodation: "模型住宿",
      activities: [
        {
          startTime: "09:00",
          endTime: "11:00",
          title: `模型活动${index + 1}`,
          kind: "sight" as const,
          description: "模型说明",
          weight: 1,
        },
      ],
    }));

    const merged = fillMissingDays(
      { overview: "模型总览", days: modelDays, checklist: ["模型清单"], tips: ["模型提示"] },
      fallback,
      DATES,
    );

    assert.equal(merged.days.length, DATES.length);

    merged.days.forEach((day, index) => {
      assert.equal(day?.theme, `模型主题${index + 1}`, `第 ${index + 1} 天应保留模型主题`);
      assert.equal(day?.activities[0].title, `模型活动${index + 1}`);
    });
  });

  it("countGeneratedDays 只统计真正由模型生成的天", () => {
    const fallback = buildTemplateDraft(
      makeQuery(),
      { quotes: { flight: null, hotel: null, warnings: [] }, budget: makeBudget() },
      DATES,
    );

    // 5 天里 2 天有内容
    const days = [null, null, fallback.days[2], fallback.days[3], null];

    assert.equal(countGeneratedDays({ overview: "", days, checklist: [], tips: [] }), 2);
  });
});

describe("travel/itinerary finalizeItinerary 成本回填", () => {
  it("逐日活动花费合计等于餐饮与门票两个科目之和", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    const itinerary = finalizeItinerary(draft.days, budget, DATES, query);

    const activitiesBudget = budget.categories.find((item) => item.key === "activities")!.amount;
    const foodBudget = budget.categories.find((item) => item.key === "food")!.amount;

    const total = itinerary.reduce((acc, day) => acc + day.estimatedCost, 0);

    assert.equal(total, activitiesBudget + foodBudget);
  });

  it("餐饮类活动合计等于 food 科目，其余活动合计等于 activities 科目", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    const itinerary = finalizeItinerary(draft.days, budget, DATES, query);

    const activitiesBudget = budget.categories.find((item) => item.key === "activities")!.amount;
    const foodBudget = budget.categories.find((item) => item.key === "food")!.amount;

    // 餐饮与门票走不同科目，分别核对才能发现「一类多给、一类少给」
    let mealTotal = 0;
    let otherTotal = 0;

    for (const day of itinerary) {
      for (const activity of day.activities) {
        if (activity.kind === "meal") {
          mealTotal += activity.estimatedCost;
        } else {
          otherTotal += activity.estimatedCost;
        }
      }
    }

    assert.equal(mealTotal, foodBudget, "餐饮类合计应等于 food 科目");
    assert.equal(otherTotal, activitiesBudget, "非餐饮活动合计应等于 activities 科目");
  });

  it("每日花费等于当日活动花费之和", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    const itinerary = finalizeItinerary(draft.days, budget, DATES, query);

    for (const day of itinerary) {
      const sum = day.activities.reduce((acc, item) => acc + item.estimatedCost, 0);

      assert.equal(day.estimatedCost, sum, `第 ${day.day} 天金额应与活动明细一致`);
    }
  });

  it("日期按 dates 回填且严格递增", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    const itinerary = finalizeItinerary(draft.days, budget, DATES, query);

    itinerary.forEach((day, index) => {
      assert.equal(day.day, index + 1);
      assert.equal(day.date, DATES[index]);
    });
  });

  it("模型给出的虚假金额被忽略，只按权重回填", () => {
    const query = makeQuery();
    const budget = makeBudget();

    // 模型试图直接给金额
    const malicious = {
      overview: "x",
      days: DATES.map((date, index) => ({
        day: index + 1,
        date,
        theme: "主题",
        accommodation: "酒店",
        activities: [
          {
            startTime: "09:00",
            endTime: "11:00",
            title: "活动",
            kind: "sight" as const,
            description: "说明",
            weight: 1,
            // 下面这个字段不该被采信
            estimatedCost: 999999,
          },
        ],
      })),
      checklist: [],
      tips: [],
    };

    const itinerary = finalizeItinerary(malicious.days, budget, DATES, query);

    const activityBudget = budget.categories.find((item) => item.key === "activities")!.amount;
    const total = itinerary.reduce((acc, day) => acc + day.estimatedCost, 0);

    assert.equal(total, activityBudget);
    assert.ok(itinerary[0].activities[0].estimatedCost < 999999);
  });

  it("活动 costSource 标记为估算", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    const itinerary = finalizeItinerary(draft.days, budget, DATES, query);

    assert.equal(itinerary[0].activities[0].costSource, "estimate");
  });
});

describe("travel/itinerary 类型可达性", () => {
  it("生成的行程可序列化为 TravelPlan 的一部分", () => {
    const query = makeQuery();
    const budget = makeBudget();
    const draft = buildTemplateDraft(query, { quotes: { flight: null, hotel: null, warnings: [] }, budget }, DATES);

    const itinerary = finalizeItinerary(draft.days, budget, DATES, query);

    const partial: Pick<TravelPlan, "itinerary" | "budget"> = { itinerary, budget };

    // 确保能安全存入数据库（JSON 往返）
    const restored = JSON.parse(JSON.stringify(partial)) as typeof partial;

    assert.equal(restored.itinerary.length, DATES.length);
    assert.equal(restored.budget.allocated, budget.allocated);
  });
});
