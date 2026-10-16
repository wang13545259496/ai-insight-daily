/**
 * 刷新实体的统计字段。
 *
 * Entity 上的 newsCount / eventCount / lastSeenAt 是冗余字段 ——
 * 冗余的理由：列表页要按活跃度排序，若每次实时聚合 NewsEntity(未来上万行)
 * 会很慢。代价是需要一个刷新任务保持同步。
 *
 * 用法：
 *   npx tsx scripts/refreshEntityStats.ts --dry-run
 *   npx tsx scripts/refreshEntityStats.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { prisma } = await import("@/lib/prisma");

  console.log("=".repeat(58));
  console.log("刷新实体统计");
  console.log("=".repeat(58));
  console.log("");

  const entities = await prisma.entity.findMany({
    where: { status: { not: "merged" } },
    select: { id: true, name: true, type: true },
  });

  console.log(`  实体数: ${entities.length}`);
  console.log("");

  let updated = 0;
  const rows: Array<{ name: string; type: string; events: number; news: number }> = [];

  for (const e of entities) {
    const eventCount = await prisma.eventEntity.count({ where: { entityId: e.id } });
    const newsCount = await prisma.newsEntity.count({ where: { entityId: e.id } });

    if (!dryRun && (eventCount > 0 || newsCount > 0)) {
      await prisma.entity.update({
        where: { id: e.id },
        data: { eventCount, newsCount },
      });
      updated++;
    }

    if (eventCount > 0) {
      rows.push({ name: e.name, type: e.type, events: eventCount, news: newsCount });
    }
  }

  rows.sort((a, b) => b.events - a.events);

  console.log(`  有关联事件的实体: ${rows.length}`);
  console.log("");
  console.log("  === 关联最多的事件实体（前 25）===");
  for (const r of rows.slice(0, 25)) {
    console.log(`    ${r.name.padEnd(30)} ${r.type.padEnd(8)} 事件 ${r.events}`);
  }

  if (dryRun) {
    console.log("");
    console.log("  预演模式，未写库");
  } else {
    console.log("");
    console.log(`  已更新: ${updated} 条`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
