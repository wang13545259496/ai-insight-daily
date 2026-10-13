import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { __setTravelAIClientForTest } from "./ai";
import { addDays, today } from "./date";

/**
 * 主流程集成测试。
 *
 * 通过 lib/travel/ai.ts 暴露的测试入口注入一个假的模型客户端，
 * 从而在不联网的前提下跑完 generateTravelPlan 全流程。
 *
 * 存在的意义：单元测试各自都过，但「模型输出被模板静默覆盖」这类问题
 * 只会在串联时暴露（生成成功、generatedByAI=true，内容却是模板的）。
 * 这个测试专门盯住「模型内容确实进入了最终方案」。
 */

const BASE_DATE = addDays(today(), 30)!;
const DATES = [0, 1, 2].map((offset) => addDays(BASE_DATE, offset)!);

/** 模型应当返回的行程 JSON */
function modelPayload(): string {
  return JSON.stringify({
    overview: "这是模型生成的总览内容，用于验证模型输出确实进入了最终方案。",
    days: DATES.map((date, index) => ({
      day: index + 1,
      date,
      theme: `模型主题${index + 1}`,
      accommodation: `模型住宿${index + 1}`,
      tips: `模型提示${index + 1}`,
      activities: [
        {
          startTime: "09:00",
          endTime: "11:30",
          title: `模型活动${index + 1}`,
          kind: "sight",
          location: `模型地点${index + 1}`,
          description: "模型给出的活动说明，用于验证内容透传。",
          weight: 1.5,
        },
        {
          startTime: "12:00",
          endTime: "13:00",
          title: `模型午餐${index + 1}`,
          kind: "meal",
          description: "模型给出的餐饮安排。",
          weight: 1,
        },
      ],
    })),
    checklist: ["模型清单项一", "模型清单项二"],
    tips: ["模型提示项一", "模型提示项二"],
  });
}

/** 记录模型调用参数，用于断言请求确实使用了 JSON 模式 */
const calls: Array<Record<string, unknown>> = [];

/** 构造一个最小的假客户端，形状与 OpenAI SDK 的调用路径一致 */
function createFakeClient(): unknown {
  return {
    chat: {
      completions: {
        create: async (payload: Record<string, unknown>) => {
          calls.push(payload);

          return {
            choices: [{ index: 0, message: { role: "assistant", content: modelPayload() } }],
          };
        },
      },
    },
  };
}

describe("travel/planner 主流程", () => {
  before(() => {
    __setTravelAIClientForTest(createFakeClient());
  });

  after(() => {
    // 还原为 null，避免影响同进程内其它测试文件
    __setTravelAIClientForTest(null);
  });

  it("模型内容进入最终方案，而不是被模板覆盖", async () => {
    const { generateTravelPlan } = await import("./planner");

    const { plan } = await generateTravelPlan({
      origin: "北京",
      destination: "东京",
      departDate: DATES[0],
      returnDate: DATES[DATES.length - 1],
      party: { adults: 2, children: 0 },
      budget: 12000,
      style: "comfort",
      interests: ["美食"],
    });

    assert.equal(plan.generatedByAI, true, "应标记为模型生成");
    assert.equal(plan.itinerary.length, DATES.length);

    plan.itinerary.forEach((day, index) => {
      assert.equal(day.theme, `模型主题${index + 1}`, `第 ${index + 1} 天主题应来自模型`);
      assert.equal(
        day.activities[0].title,
        `模型活动${index + 1}`,
        `第 ${index + 1} 天活动应来自模型`,
      );
      assert.equal(day.date, DATES[index], "日期应以请求日期为准");
    });

    assert.ok(plan.overview.includes("模型生成的总览"));
    assert.deepEqual(plan.checklist, ["模型清单项一", "模型清单项二"]);
    assert.deepEqual(plan.tips, ["模型提示项一", "模型提示项二"]);
  });

  it("请求使用 JSON 输出模式与项目统一的模型配置", async () => {
    const { generateTravelPlan } = await import("./planner");

    calls.length = 0;

    await generateTravelPlan({
      origin: "北京",
      destination: "东京",
      departDate: DATES[0],
      returnDate: DATES[DATES.length - 1],
      party: { adults: 2, children: 0 },
      budget: 12000,
      style: "comfort",
      interests: [],
    });

    assert.ok(calls.length > 0, "应当调用过模型");
    assert.deepEqual(calls[0].response_format, { type: "json_object" });
    assert.equal(typeof calls[0].model, "string");
  });

  it("模型内容不改变预算总额与分项合计", async () => {
    const { generateTravelPlan } = await import("./planner");

    const { plan } = await generateTravelPlan({
      origin: "北京",
      destination: "东京",
      departDate: DATES[0],
      returnDate: DATES[DATES.length - 1],
      party: { adults: 2, children: 0 },
      budget: 12000,
      style: "comfort",
      interests: [],
    });

    const sum = plan.budget.categories.reduce((acc, item) => acc + item.amount, 0);

    assert.equal(plan.budget.total, 12000);
    assert.equal(sum, 12000, "预算分项之和必须等于总预算");

    const activityBudget = plan.budget.categories
      .filter((item) => item.key === "activities" || item.key === "food")
      .reduce((acc, item) => acc + item.amount, 0);

    const dailySum = plan.itinerary.reduce((acc, day) => acc + day.estimatedCost, 0);

    assert.equal(dailySum, activityBudget);
  });

  it("报价缺凭据时降级为估算，但仍产出完整方案", async () => {
    const { generateTravelPlan } = await import("./planner");

    const { plan, warnings } = await generateTravelPlan({
      origin: "北京",
      destination: "曼谷",
      departDate: DATES[0],
      returnDate: DATES[DATES.length - 1],
      party: { adults: 2, children: 1 },
      budget: 9000,
      style: "comfort",
      interests: ["美食"],
    });

    assert.equal(plan.quotes.flight?.confidence, "estimate");
    assert.equal(plan.itinerary.length, DATES.length);
    assert.equal(plan.budget.allocated, 9000);
    assert.ok(warnings.some((item) => item.includes("估算模式")));
    assert.equal(
      plan.warnings.some((item) => item.includes("不一致")),
      false,
      `不应出现不一致告警：${plan.warnings.join("；")}`,
    );
  });
});
