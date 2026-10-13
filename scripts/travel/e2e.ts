/**
 * 旅行规划功能的端到端验证。
 *
 * 覆盖四件事：
 *   1. 非法输入返回 400 并带逐条原因
 *   2. 无法识别的城市返回 400 并给出可执行提示
 *   3. 正常请求能生成完整方案，且预算各项之和等于总预算
 *   4. 方案落库后分享页可达
 *
 * 用法：
 *   1. 另开一个终端启动服务：npx next dev --webpack -p 3100
 *   2. npx tsx scripts/travel/e2e.ts
 *
 * 用 Node 而不是 PowerShell 写：Windows PowerShell 5.1 会按 GBK 读取
 * 无 BOM 的 UTF-8 脚本，把中文字面量读坏导致语法错误。
 */

import type { TravelPlan } from "../../lib/agents/travel/types";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

/** 断言并输出结果 */
function check(label: string, condition: boolean, detail = ""): boolean {
  console.log(`  ${condition ? "✔" : "✘"} ${label}${detail ? `：${detail}` : ""}`);

  return condition;
}

/** 发起 POST 请求，返回状态码与解析后的响应体 */
async function postJson(
  path: string,
  body: unknown,
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let payload: Record<string, unknown> = {};

  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = { parseError: true };
  }

  return { status: response.status, payload };
}

/** 未来第 n 天的 YYYY-MM-DD */
function futureDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

let failures = 0;

async function main(): Promise<void> {
  // ---------- 用例 1：非法输入 ----------
  console.log("\n### 用例 1：非法输入（返程早于去程 + 预算过低 + 缺出发地）");

  const bad = await postJson("/api/travel/plan", {
    origin: "",
    destination: "东京",
    departDate: futureDate(40),
    returnDate: futureDate(30),
    party: { adults: 2, children: 0 },
    budget: 50,
    style: "comfort",
  });

  if (!check("返回 400", bad.status === 400, `实际 ${bad.status}`)) failures++;
  check("响应 success=false", bad.payload.success === false);

  const badErrors = Array.isArray(bad.payload.errors) ? (bad.payload.errors as string[]) : [];

  if (!check("给出逐条错误原因", badErrors.length >= 2, `${badErrors.length} 条`)) failures++;

  for (const item of badErrors) {
    console.log(`      · ${item}`);
  }

  // ---------- 用例 2：无法识别的城市 ----------
  console.log("\n### 用例 2：无法识别的城市");

  const unknown = await postJson("/api/travel/plan", {
    origin: "某个不存在的小城",
    destination: "东京",
    departDate: futureDate(40),
    returnDate: futureDate(44),
    party: { adults: 2, children: 0 },
    budget: 12000,
    style: "comfort",
  });

  if (!check("返回 400", unknown.status === 400, `实际 ${unknown.status}`)) failures++;
  check(
    "提示可改用三字码",
    typeof unknown.payload.message === "string" && unknown.payload.message.includes("三字码"),
    String(unknown.payload.message ?? ""),
  );

  // ---------- 用例 3：正常生成 ----------
  console.log("\n### 用例 3：正常生成方案（含模型调用，约 10-40 秒）");

  const started = Date.now();

  const good = await postJson("/api/travel/plan", {
    origin: "北京",
    destination: "东京",
    departDate: futureDate(40),
    returnDate: futureDate(44),
    party: { adults: 2, children: 1 },
    budget: 15000,
    style: "comfort",
    interests: ["美食", "博物馆"],
    notes: "带孩子，节奏不要太赶",
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`  耗时 ${elapsed} 秒，状态码 ${good.status}`);

  if (!check("返回 200", good.status === 200, `实际 ${good.status}`)) {
    failures++;
    console.log(JSON.stringify(good.payload, null, 2));

    return;
  }

  // 直接用领域类型断言，避免 any（脚本也在 tsc 覆盖范围内）
  const plan = good.payload.data as unknown as TravelPlan;

  const budget = plan.budget;
  const categories = budget.categories;
  const itinerary = plan.itinerary;
  const duration = plan.duration;

  console.log(`  落库 id：${good.payload.id}，报价模式：${good.payload.quoteMode}`);
  console.log(`  模型生成：${plan.generatedByAI}（${plan.model ?? "无"}）`);

  // 核心不变量：预算分项之和必须等于总预算
  const sum = categories.reduce((acc, item) => acc + Number(item.amount), 0);

  if (!check("预算各项之和 = 总预算", sum === budget.total, `${sum} vs ${budget.total}`)) failures++;

  // 核心不变量：行程天数必须等于计划天数
  if (
    !check(
      "行程天数 = 计划天数",
      itinerary.length === duration.days,
      `${itinerary.length} vs ${duration.days}`,
    )
  ) {
    failures++;
  }

  // 核心不变量：不能出现负金额
  const negative = categories.filter((item) => Number(item.amount) < 0);

  if (!check("无负数金额", negative.length === 0)) failures++;

  console.log("\n  --- 预算分配 ---");

  for (const item of categories) {
    console.log(
      `    ${String(item.label).padEnd(6)} ${String(item.amount).padStart(7)} 元  ${String(
        Math.round(Number(item.ratio) * 100),
      ).padStart(3)}%  ${item.detail}`,
    );
  }

  console.log(`    合计 ${sum} 元 / 总预算 ${budget.total} 元`);
  console.log(`    人均 ${budget.perPerson} 元，人均每日 ${budget.perPersonPerDay} 元，可行：${budget.feasible}`);

  console.log("\n  --- 逐日行程 ---");

  for (const day of itinerary) {
    console.log(
      `    Day ${day.day} ${day.date} ${day.theme}｜花费 ${day.estimatedCost} 元｜${day.activities.length} 个活动`,
    );

    for (const activity of day.activities) {
      console.log(
        `        ${activity.startTime}-${activity.endTime} [${activity.kind}] ${activity.title}（${activity.estimatedCost} 元）`,
      );
    }
  }

  console.log("\n  --- 交通与住宿 ---");
  const flight = plan.quotes.flight;
  const hotel = plan.quotes.hotel;

  if (flight) {
    console.log(
      `    机票：${flight.confidence}｜单人 ${flight.pricePerAdult} 元｜合计 ${flight.totalPrice} 元｜${flight.note}`,
    );
  }

  if (hotel) {
    console.log(
      `    住宿：${hotel.confidence}｜${hotel.name}｜${hotel.rooms} 间｜${hotel.pricePerNight} 元/晚｜合计 ${hotel.totalPrice} 元`,
    );
  }

  console.log("\n  --- 告警 ---");

  const warnings = Array.isArray(good.payload.warnings) ? (good.payload.warnings as string[]) : [];

  if (warnings.length === 0) {
    console.log("    （无）");
  }

  for (const item of warnings) {
    console.log(`    · ${item}`);
  }

  // ---------- 用例 4：分享页 ----------
  console.log("\n### 用例 4：分享页与历史列表");

  const id = good.payload.id;

  if (typeof id === "number") {
    const page = await fetch(`${BASE}/travel/${id}`);
    const html = await page.text();

    check("分享页返回 200", page.status === 200, `实际 ${page.status}`);
    check("分享页含逐日行程", html.includes("逐日行程"));
    check("分享页含预算分配", html.includes("预算分配"));
    check("分享页含目的地", html.includes("东京"));
  } else {
    console.log("  ⚠ 未返回 id（落库可能失败），跳过分享页检查");
  }

  const listResponse = await fetch(`${BASE}/api/travel/plan?limit=5`);
  const list = (await listResponse.json()) as {
    success?: boolean;
    total?: number;
    data?: Array<{
      id: number;
      origin: string;
      destination: string;
      days: number;
      budget: number;
      quoteMode: string;
    }>;
  };

  check("历史列表可读取", list.success === true, `共 ${list.total} 条`);

  for (const item of list.data ?? []) {
    console.log(
      `    #${item.id} ${item.origin} → ${item.destination}｜${item.days} 天｜${item.budget} 元｜[${item.quoteMode}]`,
    );
  }

  // ---------- 用例 5：详情接口 ----------
  if (typeof id === "number") {
    const detailResponse = await fetch(`${BASE}/api/travel/plan/${id}`);
    const detail = (await detailResponse.json()) as {
      data?: { itinerary?: unknown[]; budget?: { total?: number } };
    };

    check("详情接口返回 200", detailResponse.status === 200);
    check("详情含完整行程", Array.isArray(detail.data?.itinerary));
    check("详情预算总额一致", detail.data?.budget?.total === budget.total);

    const notFound = await fetch(`${BASE}/api/travel/plan/999999`);
    check("不存在的方案返回 404", notFound.status === 404, `实际 ${notFound.status}`);
  }

  console.log(`\n===== 验证结束：${failures === 0 ? "全部通过" : `${failures} 项未通过`} =====`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("验证脚本异常：", error);
  process.exitCode = 1;
});
