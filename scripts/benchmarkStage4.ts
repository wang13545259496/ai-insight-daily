/**
 * 阶段 4 成本与耗时基准测试。
 *
 * 背景：实体是从新闻正文中抽取的（阶段 2 已校验「必须逐字出现」），
 * 因此把实体关联回新闻可以用**确定性匹配**，不必调模型。
 *
 * 但 1668 条新闻 × 1502 个实体 = 250 万次比对，
 * 需要实测耗时，不能靠估算。
 *
 * 本脚本用不同策略各跑 100 条，外推全量耗时。
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/** 从 |a|b| 取别名 */
function pickAliases(aliases: string): string[] {
  return aliases
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/** 纯 ASCII 用词边界，中文用包含 */
function countIn(text: string, needle: string): number {
  if (!needle || needle.length < 2) return 0;

  if (/^[\x20-\x7E]+$/.test(needle)) {
    const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`, "gi");
    let n = 0;
    while (re.exec(text) !== null) {
      n++;
      if (n > 20) break;
    }
    return n;
  }

  let n = 0;
  let idx = text.indexOf(needle);
  while (idx !== -1 && n <= 20) {
    n++;
    idx = text.indexOf(needle, idx + needle.length);
  }
  return n;
}

const SAMPLE = 100;

async function main() {
  const { prisma } = await import("@/lib/prisma");

  console.log("=".repeat(62));
  console.log("阶段 4 基准测试");
  console.log("=".repeat(62));
  console.log("");

  const entities = await prisma.entity.findMany({
    where: { status: { not: "merged" } },
    select: { id: true, name: true, aliases: true, type: true },
  });

  const news = await prisma.news.findMany({
    where: { analysisStatus: "completed" },
    select: { id: true, title: true, summary: true, content: true },
    orderBy: { publishedAt: "desc" },
    take: SAMPLE,
  });

  const totalNews = await prisma.news.count({ where: { analysisStatus: "completed" } });

  console.log(`  实体数:     ${entities.length}`);
  console.log(`  新闻总数:   ${totalNews}`);
  console.log(`  抽样条数:   ${news.length}`);
  console.log("");

  // 预计算别名，避免每条新闻重复解析
  const index = entities.map((e) => ({
    id: e.id,
    type: e.type,
    names: [e.name, ...pickAliases(e.aliases)],
  }));

  // ---------- 策略 A：标题 + 摘要 ----------
  console.log("=== 策略 A：匹配 标题 + 摘要 ===");

  let t0 = Date.now();
  let linksA = 0;

  for (const n of news) {
    const text = `${n.title} ${n.summary || ""}`;

    for (const e of index) {
      let hit = 0;
      for (const nm of e.names) {
        hit += countIn(text, nm);
        if (hit > 0) break;
      }
      if (hit > 0) linksA++;
    }
  }

  const timeA = Date.now() - t0;
  console.log(`  耗时:       ${(timeA / 1000).toFixed(2)}s（${news.length} 条）`);
  console.log(`  关联数:     ${linksA}`);
  console.log(`  平均每条:   ${(linksA / news.length).toFixed(1)} 个实体`);
  console.log(`  外推全量:   约 ${((timeA / 1000) * (totalNews / news.length) / 60).toFixed(1)} 分钟`);

  // ---------- 策略 B：标题 + 摘要 + 正文 ----------
  console.log("");
  console.log("=== 策略 B：匹配 标题 + 摘要 + 正文（前 2000 字）===");

  t0 = Date.now();
  let linksB = 0;

  for (const n of news) {
    const text = `${n.title} ${n.summary || ""} ${(n.content || "").slice(0, 2000)}`;

    for (const e of index) {
      let hit = 0;
      for (const nm of e.names) {
        hit += countIn(text, nm);
        if (hit > 0) break;
      }
      if (hit > 0) linksB++;
    }
  }

  const timeB = Date.now() - t0;
  console.log(`  耗时:       ${(timeB / 1000).toFixed(2)}s（${news.length} 条）`);
  console.log(`  关联数:     ${linksB}`);
  console.log(`  平均每条:   ${(linksB / news.length).toFixed(1)} 个实体`);
  console.log(`  外推全量:   约 ${((timeB / 1000) * (totalNews / news.length) / 60).toFixed(1)} 分钟`);

  // ---------- 写入耗时估算 ----------
  console.log("");
  console.log("=== 写库耗时（SQLite 逐条 upsert）===");

  const estimateWrites = linksB * (totalNews / news.length);
  console.log(`  预计写入行数: 约 ${Math.round(estimateWrites)} 条`);
  console.log(`  按每 1000 条约 1-2 秒估算，写库约 1-3 分钟`);

  console.log("");
  console.log("=== 结论 ===");
  console.log(`  确定性匹配总耗时: 约 ${Math.max(
    (timeA / 1000) * (totalNews / news.length),
    (timeB / 1000) * (totalNews / news.length),
  ) / 60 < 1 ? "不足 1" : Math.round(
    Math.max(
      (timeA / 1000) * (totalNews / news.length),
      (timeB / 1000) * (totalNews / news.length),
    ) / 60,
  )} 分钟`);
  console.log("  模型调用费用: 0 元（不调模型）");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("失败:", e);
  process.exit(1);
});
