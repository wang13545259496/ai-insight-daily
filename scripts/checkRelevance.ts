import { checkAiRelevance } from "../lib/news/relevance";
// @ts-expect-error node:sqlite 是实验性 API，@types/node 未包含其类型声明
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";

/**
 * 用现有数据库验证相关性词表
 *
 * 除了通过率，还按**来源**统计被拦下的分布 ——
 * 如果被拦的集中在少数泛科技源，说明可以按源豁免，
 * 比逐条关键词判断更稳。
 */

const dbPath = process.argv[2] || "prisma/dev.db";

if (!existsSync(dbPath)) {
  console.error(`找不到数据库：${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });
const rows = db
  .prepare(
    `SELECT n.title, n.summary, COALESCE(s.name, '未知来源') AS src
     FROM News n LEFT JOIN Source s ON s.id = n.sourceId
     WHERE n.dataStatus = 'active' ORDER BY n.id DESC`,
  )
  .all() as Array<{ title: string; summary: string | null; src: string }>;

let pass = 0;
const blocked: Array<{ title: string; src: string }> = [];
const byBlocked = new Map<string, number>();
const byTotal = new Map<string, number>();

for (const r of rows) {
  byTotal.set(r.src, (byTotal.get(r.src) || 0) + 1);
  const res = checkAiRelevance(r.title || "", r.summary || "", r.src);
  if (res.related) {
    pass++;
  } else {
    blocked.push({ title: r.title || "", src: r.src });
    byBlocked.set(r.src, (byBlocked.get(r.src) || 0) + 1);
  }
}

const total = rows.length;

console.log("=== 总体 ===");
console.log(`  样本:   ${total}`);
console.log(`  通过:   ${pass} (${((pass / total) * 100).toFixed(1)}%)`);
console.log(`  被拦:   ${blocked.length} (${((blocked.length / total) * 100).toFixed(1)}%)`);

console.log("");
console.log("=== 按来源看拦截率 ===");
console.log("  来源                     总数   被拦   拦截率");
console.log("  " + "-".repeat(52));

const srcs = [...byTotal.entries()].sort((a, b) => (byBlocked.get(b[0]) || 0) - (byBlocked.get(a[0]) || 0));
for (const [src, tot] of srcs) {
  const blk = byBlocked.get(src) || 0;
  if (blk === 0) continue;
  const rate = ((blk / tot) * 100).toFixed(0);
  console.log(`  ${src.padEnd(22)} ${String(tot).padStart(5)} ${String(blk).padStart(6)}   ${rate.padStart(3)}%`);
}

const clean = srcs.filter(([s]) => (byBlocked.get(s) || 0) === 0);
if (clean.length) {
  console.log("");
  console.log("  零拦截的来源（说明这些源的内容天然相关）:");
  for (const [s, tot] of clean) console.log(`    ${s} (${tot})`);
}

console.log("");
console.log("=== 被拦样本（带来源）===");
for (const b of blocked.slice(0, 30)) {
  console.log(`  [${b.src.slice(0, 12).padEnd(12)}] ${b.title.slice(0, 58)}`);
}
if (blocked.length > 30) console.log(`  ... 还有 ${blocked.length - 30} 条`);

db.close();
