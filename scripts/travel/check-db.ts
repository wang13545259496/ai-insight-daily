/**
 * 检查落库的旅行方案。
 *
 * 验证的不变量：存进去的 JSON 能被解析出来，且金额与天数自洽。
 * 用法：npx tsx scripts/travel/check-db.ts
 */

import { PrismaClient } from "@prisma/client";

import type { TravelPlan } from "../../lib/agents/travel/types";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const rows = await prisma.tripPlan.findMany({
    orderBy: { id: "desc" },
    take: 5,
    select: {
      id: true,
      origin: true,
      destination: true,
      departDate: true,
      returnDate: true,
      adults: true,
      children: true,
      budget: true,
      style: true,
      quoteMode: true,
      generatedByAI: true,
      model: true,
      interests: true,
      planJson: true,
      createdAt: true,
    },
  });

  console.log(`共 ${rows.length} 条方案\n`);

  for (const row of rows) {
    let plan: TravelPlan | null = null;

    try {
      plan = JSON.parse(row.planJson) as TravelPlan;
    } catch {
      console.log(`#${row.id} JSON 解析失败`);
      continue;
    }

    const allocated = plan.budget.categories.reduce((acc, item) => acc + item.amount, 0);

    const budgetOk = allocated === plan.budget.total ? "✔" : "✘";
    const daysOk = plan.itinerary.length === plan.duration.days ? "✔" : "✘";

    console.log(
      `#${row.id} ${row.origin} → ${row.destination}｜${row.departDate} ~ ${row.returnDate}｜` +
        `成人 ${row.adults} 儿童 ${row.children}｜预算 ${row.budget} ${row.style}｜` +
        `[${row.quoteMode}] AI=${row.generatedByAI} model=${row.model ?? "-"}`,
    );
    console.log(
      `    兴趣：${row.interests ?? "（无）"}｜总览 ${plan.overview.length} 字｜` +
        `${plan.itinerary.length}/${plan.duration.days} 天 ${daysOk}｜` +
        `预算 ${allocated}/${plan.budget.total} ${budgetOk}`,
    );
    console.log(`    存放于 ${row.createdAt.toISOString()}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("检查失败：", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
