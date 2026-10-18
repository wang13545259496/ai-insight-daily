/**
 * 回填事件摘要
 *
 * 用法：
 *   npx tsx scripts/backfillEventSummary.ts --limit 2 --dry-run   先试 2 条看质量
 *   npx tsx scripts/backfillEventSummary.ts                       全量写入
 *   npx tsx scripts/backfillEventSummary.ts --dry-run             只看不写
 *
 * ## 为什么用动态 import
 *
 * `lib/ai-summary.ts` 在**模块顶层**读取 `process.env.DEEPSEEK_API_KEY`
 * 并构造 client。而 ES 模块的 import 会被提升到文件顶部、先于
 * `dotenv.config()` 执行 —— 静态 import 会导致环境变量还没加载，
 * client 就是 null，脚本报「未配置 API Key」。
 *
 * 所以必须先 dotenv.config()，再 `await import()`。
 * 项目里的 analyzePending.ts 踩过同一个坑，注释写得很清楚。
 *
 * ## 只处理模板摘要
 *
 * 条件：summary 含「形成的AI产业事件」（旧模板的固定后半句）。
 * 已有真实摘要的事件不动。
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

function parseArgs() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");

  return {
    limit: limitIdx >= 0 ? Number(args[limitIdx + 1]) || 0 : 0,
    dryRun: args.includes("--dry-run"),
  };
}

async function main() {
  const { limit, dryRun } = parseArgs();

  // 环境变量已加载，此时才能实例化依赖它的模块
  const [{ prisma }, ai] = await Promise.all([
    import("../lib/prisma"),
    import("../lib/ai-summary"),
  ]);

  if (!ai.isAIConfigured()) {
    console.error("✗ 未配置 DEEPSEEK_API_KEY，无法生成摘要");
    process.exit(1);
  }

  const events = await prisma.newsEvent.findMany({
    where: { summary: { contains: "形成的AI产业事件" } },
    orderBy: { updatedAt: "desc" },
    take: limit || undefined,
  });

  if (!events.length) {
    console.log("没有需要回填的事件（摘要已是真实内容）");
    return;
  }

  console.log(
    `待回填 ${events.length} 个事件${dryRun ? "（dry-run，不写库）" : ""}`,
  );
  console.log("");

  let ok = 0;
  let fail = 0;

  for (const [i, ev] of events.entries()) {
    const news = await prisma.news.findMany({
      where: { eventId: ev.id },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { title: true, summary: true, content: true, source: true },
    });

    if (!news.length) {
      console.log(
        `  [${i + 1}/${events.length}] 跳过（无关联新闻）：${ev.title.slice(0, 30)}`,
      );
      fail++;
      continue;
    }

    const summary = await ai.generateEventSummary({
      title: ev.titleZh || ev.title,
      category: ev.category,
      news,
    });

    const stillTemplate = summary.includes("形成的AI产业事件");

    console.log(`  [${i + 1}/${events.length}] ${ev.title.slice(0, 34)}`);
    console.log(`      材料 ${news.length} 条新闻`);
    console.log(`      摘要 ${summary.slice(0, 130)}${summary.length > 130 ? "…" : ""}`);

    if (stillTemplate) {
      console.log("      ⚠ 仍是模板（模型调用失败），不写库");
      fail++;
      console.log("");
      continue;
    }

    if (!dryRun) {
      await prisma.newsEvent.update({
        where: { id: ev.id },
        data: { summary, updatedAt: new Date() },
      });
    }

    ok++;
    console.log("");
  }

  console.log("=== 完成 ===");
  console.log(`  成功: ${ok}`);
  console.log(`  失败: ${fail}`);
  if (dryRun) console.log("  （dry-run，未写入数据库）");
}

main()
  .catch((e) => {
    console.error("执行失败：", e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
