import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPlanDocument, documentFileName } from "./export";
import type { TravelPlan } from "./types";

/**
 * 方案导出测试。
 *
 * 覆盖「取哪些字段、怎么格式化」这类容易出错的逻辑；
 * docx 渲染层是机械映射，不做单测（产物是二进制），
 * 改为端到端验证下载文件可被解析。
 */

/** 一份最小可用的方案 */
function makePlan(over: Partial<TravelPlan> = {}): TravelPlan {
  const base: TravelPlan = {
    query: {
      origin: "上海",
      destination: "杭州",
      departDate: "2026-11-01",
      returnDate: "2026-11-04",
      party: { adults: 2, children: 0 },
      budget: 6000,
      style: "comfort",
      interests: ["美食"],
      notes: "希望节奏轻松些",
    },
    duration: { nights: 3, days: 4 },
    quotes: {
      flight: {
        confidence: "live",
        provider: "variflight",
        note: "飞常准实时票价",
        fetchedAt: "2026-10-15T00:00:00.000Z",
        pricePerAdult: 700,
        totalPrice: 1400,
        currency: "CNY",
        outbound: [
          {
            from: "SHA",
            to: "HGH",
            departAt: "2026-11-01T09:00:00",
            arriveAt: "2026-11-01T10:00:00",
            carrier: "MU",
            flightNumber: "MU1",
          },
        ],
        inbound: [],
        totalDurationMinutes: 60,
        stops: 0,
      },
      hotel: {
        confidence: "live",
        provider: "rollinggo",
        note: "RollingGo 实时报价",
        fetchedAt: "2026-10-15T00:00:00.000Z",
        name: "测试酒店",
        rating: 4,
        pricePerNight: 420,
        totalPrice: 1260,
        currency: "CNY",
        rooms: 1,
        location: "西湖区某路 1 号",
        bookingUrl: "https://book.example/1",
      },
      warnings: [],
    },
    budget: {
      total: 6000,
      currency: "CNY",
      categories: [
        {
          key: "transport",
          label: "交通",
          amount: 1400,
          ratio: 0.2333,
          perPerson: 700,
          lockedByQuote: true,
          detail: "真实报价：往返",
        },
        {
          key: "accommodation",
          label: "住宿",
          amount: 1260,
          ratio: 0.21,
          perPerson: 630,
          lockedByQuote: true,
          detail: "真实报价：1 间 × 3 晚",
        },
      ],
      allocated: 6000,
      perPerson: 3000,
      perPersonPerDay: 750,
      minimumViable: 4000,
      feasible: true,
      diagnosis: [],
    },
    overview: "本次杭州4天3晚舒适型行程，以美食为主线。",
    itinerary: [
      {
        day: 1,
        date: "2026-11-01",
        theme: "抵达与西湖东岸",
        activities: [
          {
            startTime: "10:00",
            endTime: "12:00",
            title: "西湖断桥",
            kind: "sight",
            description: "沿白堤漫步",
            estimatedCost: 0,
            costSource: "estimate",
            location: "断桥残雪",
            address: "西湖区北山街",
            coordinates: "120.14,30.25",
          },
        ],
        estimatedCost: 300,
        accommodation: "测试酒店",
        commuteLegs: [
          {
            from: "测试酒店",
            to: "西湖断桥",
            distanceMeters: 3200,
            durationMinutes: 18,
            mode: "transit",
            summary: "地铁 1 号线",
          },
        ],
      },
    ],
    checklist: ["身份证", "充电宝"],
    tips: ["西湖景区周末人多"],
    generatedByAI: true,
    model: "deepseek-chat",
    generatedAt: "2026-10-15T02:00:00.000Z",
    warnings: ["酒店为 RollingGo 实时报价"],
  };

  return { ...base, ...over };
}

describe("travel/export 文档结构", () => {
  it("标题含起讫城市与日期", () => {
    const doc = buildPlanDocument(makePlan());

    assert.ok(doc.header.title.includes("上海"));
    assert.ok(doc.header.title.includes("杭州"));
    assert.ok(doc.header.subtitle.includes("2026-11-01"));
    assert.ok(doc.header.subtitle.includes("4 天 3 晚"));
    assert.ok(doc.header.subtitle.includes("6000 元"));
  });

  it("★ 区块顺序为先结论后细节", () => {
    const doc = buildPlanDocument(makePlan());
    const titles = doc.sections.map((s) => s.title);

    const idx = (name: string) => titles.findIndex((t) => t.includes(name));

    assert.equal(idx("行程概览"), 0, "概览应在最前");
    assert.ok(idx("交通与住宿") > idx("行程概览"));
    assert.ok(idx("预算分配") > idx("交通与住宿"));
    assert.ok(idx("第 1 天") > idx("预算分配"), "逐日行程应在预算之后");
    assert.ok(idx("行前准备") > idx("第 1 天"));
  });

  it("概览区块含人数与偏好", () => {
    const doc = buildPlanDocument(makePlan());
    const overview = doc.sections[0];

    const labels = (overview.facts ?? []).map((f) => f.label);

    assert.ok(labels.includes("同行人数"));
    assert.ok(labels.includes("偏好"));
    assert.equal(overview.facts?.find((f) => f.label === "偏好")?.value, "美食");
  });

  it("预算档位转成中文", () => {
    const doc = buildPlanDocument(makePlan());
    const style = doc.sections[0].facts?.find((f) => f.label === "预算档位");

    assert.equal(style?.value, "舒适型");
  });

  it("补充要求写进概览段落", () => {
    const doc = buildPlanDocument(makePlan());

    assert.ok(doc.sections[0].paragraphs?.some((p) => p.includes("希望节奏轻松些")));
  });

  it("交通与住宿区块含价格与预订链接", () => {
    const doc = buildPlanDocument(makePlan());
    const section = doc.sections.find((s) => s.title === "交通与住宿");
    const values = (section?.facts ?? []).map((f) => f.value).join(" ");

    assert.ok(values.includes("700 元/人"), `实际：${values}`);
    assert.ok(values.includes("测试酒店"));
    assert.ok(values.includes("3 晚"));
    assert.ok(values.includes("https://book.example/1"));
    assert.ok(values.includes("实时报价"));
  });

  it("无住宿时说明「无需住宿」", () => {
    const plan = makePlan();

    plan.duration = { nights: 0, days: 1 };
    plan.quotes.hotel = null;

    const doc = buildPlanDocument(plan);
    const section = doc.sections.find((s) => s.title === "交通与住宿");

    assert.ok(section?.facts?.some((f) => f.value.includes("无需住宿")));
  });

  it("逐日区块含活动与通勤", () => {
    const doc = buildPlanDocument(makePlan());
    const day = doc.sections.find((s) => s.title.includes("第 1 天"));

    assert.ok(day, "应有第 1 天区块");
    assert.ok(day.bullets?.some((b) => b.includes("西湖断桥")));
    assert.ok(day.paragraphs?.some((p) => p.includes("当日通勤")));
    assert.ok(day.paragraphs?.some((p) => p.includes("公交/地铁")));
  });

  it("活动含花费与地址时才附加说明", () => {
    const doc = buildPlanDocument(makePlan());
    const day = doc.sections.find((s) => s.title.includes("第 1 天"));
    const bullet = day?.bullets?.[0] ?? "";

    assert.ok(bullet.includes("10:00-12:00"));
    assert.ok(bullet.includes("西湖断桥"));
    assert.ok(bullet.includes("西湖区北山街"));
    // 花费为 0 时不显示金额
    assert.ok(!bullet.includes("约 0 元"));
  });

  it("★ 跨城方式渲染为表格", () => {
    const plan = makePlan();

    plan.intercityOptions = [
      {
        mode: "train",
        label: "高铁",
        totalPrice: 1106,
        perPerson: 553,
        durationMinutes: 273,
        reference: "G1",
        departTime: "09:00",
        arriveTime: "13:33",
        breakdown: "上海虹桥→杭州东｜二等座",
        confidence: "live",
      },
    ];

    const doc = buildPlanDocument(plan);
    const section = doc.sections.find((s) => s.title.includes("跨城方式"));

    assert.ok(section?.table);
    assert.deepEqual(section.table.headers, ["方式", "时刻", "历时", "人均", "说明"]);
    assert.equal(section.table.rows[0][0], "高铁");
    assert.equal(section.table.rows[0][1], "09:00-13:33");
    assert.equal(section.table.rows[0][2], "4小时33分");
    assert.equal(section.table.rows[0][3], "553 元");
  });

  it("★ 房型明细渲染为列表", () => {
    const plan = makePlan();

    plan.hotelRooms = [
      {
        roomName: "标准大床房",
        averagePrice: 221,
        bedType: "1 大床",
        meal: "含早餐",
        cancelPolicy: "免费取消",
        cancelable: true,
        size: "28",
        maxOccupancy: 2,
      },
    ];

    const doc = buildPlanDocument(plan);
    const section = doc.sections.find((s) => s.title === "可选房型");
    const line = section?.bullets?.[0] ?? "";

    assert.ok(line.includes("221 元/晚"));
    assert.ok(line.includes("标准大床房"));
    assert.ok(line.includes("1 大床"));
    assert.ok(line.includes("含早餐"));
    assert.ok(line.includes("28㎡"));
    assert.ok(line.includes("可免费取消"));
  });

  it("不可免费取消时展示退改政策原文", () => {
    const plan = makePlan();

    plan.hotelRooms = [
      {
        roomName: "特价房",
        averagePrice: 199,
        bedType: "1 大床",
        meal: "不含早餐",
        cancelPolicy: "不可取消",
        cancelable: false,
        size: "",
        maxOccupancy: null,
      },
    ];

    const doc = buildPlanDocument(plan);
    const line = doc.sections.find((s) => s.title === "可选房型")?.bullets?.[0] ?? "";

    assert.ok(line.includes("不可取消"));
    assert.ok(!line.includes("可免费取消"));
  });

  it("无跨城方案与房型时不产生空区块", () => {
    const doc = buildPlanDocument(makePlan());
    const titles = doc.sections.map((s) => s.title);

    assert.ok(!titles.some((t) => t.includes("跨城方式")));
    assert.ok(!titles.some((t) => t === "可选房型"));
  });

  it("数据来源区块汇总告警", () => {
    const doc = buildPlanDocument(makePlan());
    const section = doc.sections.find((s) => s.title === "数据来源与提示");

    assert.ok(section?.bullets?.some((b) => b.includes("RollingGo")));
  });

  it("页脚含生成时间与编排方式", () => {
    const doc = buildPlanDocument(makePlan());

    assert.ok(doc.footer.includes("AI（deepseek-chat）"));
    assert.ok(doc.footer.includes("估算"));
  });

  it("模板生成时页脚如实标注", () => {
    const plan = makePlan();

    plan.generatedByAI = false;

    assert.ok(buildPlanDocument(plan).footer.includes("内置模板"));
  });
});

describe("travel/export 文件名", () => {
  it("含城市与日期", () => {
    const name = documentFileName(makePlan());

    assert.ok(name.includes("上海-杭州"));
    assert.ok(name.includes("2026-11-01"));
    assert.ok(name.endsWith(".docx"));
  });

  it("★ 剔除文件名非法字符", () => {
    const plan = makePlan();

    plan.query.origin = "上海/浦东";
    plan.query.destination = 'test:city*"<>|';

    const name = documentFileName(plan);

    for (const ch of ["/", ":", "*", '"', "<", ">", "|", "\\"]) {
      assert.ok(!name.includes(ch), `不应含 ${ch}：${name}`);
    }
  });

  it("过长时截断", () => {
    const plan = makePlan();

    plan.query.destination = "很长的目的地名称".repeat(20);

    assert.ok(documentFileName(plan).length <= 85);
  });
});
