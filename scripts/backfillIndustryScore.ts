// @ts-nocheck
/**
 * 回填事件产业价值分，并验证排序效果。
 *
 * 为什么禁用本文件的类型检查：本脚本用 node:sqlite 做只读校验，
 * 而项目依赖的 @types/node 为 v20，尚未包含 node:sqlite 的类型声明
 * （该模块是 Node 22 新增，运行时可用）。禁用可避免项目整体 tsc
 * 因此报错，不影响运行时行为，也不会放宽其他文件。
 *
 * 用法（在项目根目录）：
 *   npx tsx --env-file=.env.local scripts/backfillIndustryScore.ts
 */
import { DatabaseSync } from "node:sqlite";

import { refreshEventScores } from "@/lib/intelligence/refreshEvents";

async function main() {
  console.log("=== 回填事件分数 ===");

  const result = await refreshEventScores();

  console.log(`已刷新 ${result.updated} 个事件\n`);

  // ---------- 验证 ----------
  const db = new DatabaseSync("prisma/dev.db", { readOnly: true });

  console.log("=".repeat(86));
  console.log("按 industryScore 排序（首页将采用此顺序）");
  console.log("=".repeat(86));
  console.log("");

  const byIndustry = db
    .prepare(
      `SELECT e.id, e.title, e.industryScore, e.heatScore, e.qualityScore, e.status,
         (SELECT COUNT(*) FROM News n WHERE n.eventId = e.id AND n.dataStatus='active') newsCount
       FROM NewsEvent e WHERE e.status='active'
       ORDER BY e.industryScore DESC LIMIT 10`,
    )
    .all();

  byIndustry.forEach((e, i) => {
    const star = i < 6 ? "★" : " ";

    console.log(
      `${star} ${String(i + 1).padStart(2)}. 产业分 ${String(Math.round(e.industryScore)).padStart(5)}  ` +
        `(热度 ${String(Math.round(e.heatScore)).padStart(5)}, news ${String(e.newsCount).padStart(3)})  ` +
        `${String(e.title).slice(0, 40)}`,
    );
  });

  console.log("");
  console.log("=".repeat(86));
  console.log("对照：按 heatScore 排序（旧顺序）");
  console.log("=".repeat(86));
  console.log("");

  const byHeat = db
    .prepare(
      `SELECT e.id, e.title, e.industryScore, e.heatScore,
         (SELECT COUNT(*) FROM News n WHERE n.eventId = e.id AND n.dataStatus='active') newsCount
       FROM NewsEvent e WHERE e.status='active'
       ORDER BY e.heatScore DESC LIMIT 10`,
    )
    .all();

  byHeat.forEach((e, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}. 热度 ${String(Math.round(e.heatScore)).padStart(5)}  ` +
        `(产业分 ${String(Math.round(e.industryScore)).padStart(5)})  ${String(e.title).slice(0, 42)}`,
    );
  });

  console.log("");
  console.log("=".repeat(86));
  console.log("统计");
  console.log("=".repeat(86));

  const stats = db
    .prepare(
      `SELECT COUNT(*) c,
         SUM(CASE WHEN industryScore > 0 THEN 1 ELSE 0 END) scored,
         MIN(industryScore) mn, MAX(industryScore) mx,
         CAST(AVG(industryScore) AS INT) av
       FROM NewsEvent WHERE status='active'`,
    )
    .get();

  console.log(`  active 事件 ${stats.c} 个，已计算产业分 ${stats.scored} 个`);
  console.log(`  产业分 min ${stats.mn}｜avg ${stats.av}｜max ${stats.mx}`);

  // 排序差异
  const industryTop6 = new Set(byIndustry.slice(0, 6).map((e) => e.id));
  const heatTop6 = new Set(byHeat.slice(0, 6).map((e) => e.id));

  const onlyInIndustry = [...industryTop6].filter((id) => !heatTop6.has(id));
  const onlyInHeat = [...heatTop6].filter((id) => !industryTop6.has(id));

  console.log(`\n  与旧排序的差异：新进入 ${onlyInIndustry.length} 个，被替换掉 ${onlyInHeat.length} 个`);

  if (onlyInIndustry.length > 0) {
    console.log("\n  新排序带入的（旧排序没有的）:");
    for (const id of onlyInIndustry) {
      const e = byIndustry.find((x) => x.id === id);
      if (e) console.log(`    + ${String(e.title).slice(0, 52)}`);
    }
  }

  if (onlyInHeat.length > 0) {
    console.log("\n  新排序移除的（旧排序有的）:");
    for (const id of onlyInHeat) {
      const e = byHeat.find((x) => x.id === id);
      if (e) console.log(`    - ${String(e.title).slice(0, 52)}`);
    }
  }

  db.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("回填失败：", error);
    process.exit(1);
  });
