/**
 * 补跑未分析新闻的 AI 分析。
 *
 * 背景：
 * 全库 69 条 analysisStatus = pending，AI 分析从未执行。
 * 详情页此前会把原始正文冒充成分析结论（已在 85d937a 修掉界面），
 * 但内容本身仍然缺失 —— 本脚本补上。
 *
 * 与 reanalyzeNews.ts 的区别：
 *   · reanalyze 针对**已分析**的记录，重跑是为改进质量；
 *     本脚本针对**未分析**的记录，是首次分析。
 *   · 因此这里写全部字段（含 titleZh），并置 analysisStatus = completed，
 *     与 lib/news/analyzeNews.ts 的行为保持一致。
 *   · 写入前备份旧值，便于对照与回退。
 *
 * 用法：
 *   npx tsx scripts/analyzePending.ts --dry-run
 *   npx tsx scripts/analyzePending.ts --write
 *   npx tsx scripts/analyzePending.ts --write --limit 10
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";

const BACKUP_DIR = "backup/pending-analysis";

function parseArgs(argv: string[]) {
  const o = { write: false, limit: null as number | null, concurrency: 3 };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--write") o.write = true;
    else if (argv[i] === "--limit") o.limit = Number(argv[++i]) || null;
    else if (argv[i] === "--concurrency") o.concurrency = Math.max(1, Number(argv[++i]) || 3);
  }

  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // 动态 import：ai-summary 在顶层读取环境变量，必须等 dotenv 执行完
  const { prisma } = await import("@/lib/prisma");
  const { generateSummary, isAIConfigured } = await import("@/lib/ai-summary");

  console.log("=".repeat(60));
  console.log(opts.write ? "补跑未分析的新闻（写库）" : "补跑未分析的新闻（预演）");
  console.log("=".repeat(60));
  console.log("");

  const rows = await prisma.news.findMany({
    where: { analysisStatus: "pending" },
    select: { id: true, title: true, content: true, summary: true, source: true },
    orderBy: { id: "asc" },
  });

  const queue = rows.slice(0, opts.limit ?? rows.length);

  console.log(`  pending 总数: ${rows.length}`);
  console.log(`  本次处理:     ${queue.length}`);

  const bySource: Record<string, number> = {};
  for (const r of queue) bySource[r.source || "(无)"] = (bySource[r.source || "(无)"] || 0) + 1;
  console.log("  按来源:");
  for (const [s, c] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s.padEnd(20)} ${c}`);
  }

  const cost = (queue.length * 900) / 1e6 + (queue.length * 900 * 2) / 1e6;
  console.log("");
  console.log(`  预计费用: 约 ¥${cost.toFixed(2)}`);
  console.log(`  预计耗时: 约 ${Math.round((queue.length * 9) / 60)} 分钟`);

  if (!opts.write) {
    console.log("");
    console.log("  预演模式。抽样 3 条待处理记录：");
    for (const r of queue.slice(0, 3)) {
      console.log("");
      console.log(`    id=${r.id} [${r.source}]`);
      console.log(`      标题: ${(r.title || "").slice(0, 56)}`);
      console.log(`      正文: ${(r.content || "").replace(/\s+/g, " ").slice(0, 80)}`);
    }
    console.log("");
    console.log("  确认后加 --write 执行");
    await prisma.$disconnect();
    return;
  }

  if (!isAIConfigured()) {
    console.error("✗ 模型未配置，已中止");
    process.exit(1);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const startedAt = Date.now();
  let done = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= queue.length) return;

      const news = queue[i];

      try {
        const result = await generateSummary(
          news.title,
          news.content || news.summary || "",
        );

        // 备份旧值
        fs.writeFileSync(
          path.join(BACKUP_DIR, `${news.id}.json`),
          JSON.stringify(
            {
              id: news.id,
              title: news.title,
              source: news.source,
              before: { content: news.content, summary: news.summary },
              after: {
                titleZh: result.titleZh,
                summary: result.summary,
                content: result.content,
                insight: result.insight,
              },
              at: new Date().toISOString(),
            },
            null,
            2,
          ),
        );

        // 写全部字段并置为 completed，与 lib/news/analyzeNews.ts 行为一致
        await prisma.news.update({
          where: { id: news.id },
          data: {
            titleZh: result.titleZh,
            background: result.background,
            summary: result.summary,
            content: result.content,
            insight: result.insight,
            impact: result.impact,
            businessOpportunity: result.businessOpportunity,
            investmentView: result.investmentView,
            aiScore: result.aiScore,
            analysisStatus: "completed",
          },
        });

        done++;

        if (done % 10 === 0 || done === queue.length) {
          const el = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
          console.log(`  进度 ${done}/${queue.length}（失败 ${failed}）｜${el} 分钟`);
        }
      } catch (e) {
        failed++;
        console.error(`  ✗ id=${news.id}: ${String(e).slice(0, 100)}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(opts.concurrency, queue.length) }, () => worker()),
  );

  const mins = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);

  console.log("");
  console.log("=".repeat(60));
  console.log("完成");
  console.log("=".repeat(60));
  console.log("");
  console.log(`  成功: ${done}`);
  console.log(`  失败: ${failed}`);
  console.log(`  耗时: ${mins} 分钟`);
  console.log(`  旧值备份: ${BACKUP_DIR}/`);

  const remain = await prisma.news.count({ where: { analysisStatus: "pending" } });
  console.log(`  仍为 pending: ${remain} 条`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
