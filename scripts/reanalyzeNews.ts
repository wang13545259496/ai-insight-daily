/**
 * 用改进后的提示词重新分析新闻。
 *
 * 背景：
 * 原提示词导致 impact 字段高度公式化 —— 实测 87% 以「对AI产业而言，…」开头，
 * 且所有来源一致（OpenAI 88%、arXiv 97%、OSChina 78%），说明是提示词问题。
 * 改进提示词后实测 12 条样本的公式化比例从 92% 降到 0%，内容也从宏观套话
 * 转为具体机制。本脚本用于把历史数据也重新过一遍。
 *
 * 安全性设计：
 *
 *   1. **默认预演**。不传 --write 时只统计与抽样，不调模型、不写库。
 *
 *   2. **只更新分析字段**。明确列出字段，不触碰 title、titleZh、content、
 *      summary、sourceUrl、publishedAt 等 —— 避免覆盖已生成的中文标题
 *      或抓取到的正文。
 *
 *   3. **备份旧分析**。每次更新前把旧的 impact/insight 等写入
 *      `backup/reanalysis/<id>.json`，便于回退或人工对照。
 *
 *   4. **可断点续跑**。用 analysisStatus 区分：写回后置为 completed，
 *      未处理的保持原状。中断后重跑会跳过已完成的。
 *
 *   5. **按范围限定**。--days N 只处理近 N 天，避免一次跑全量。
 *
 * 用法：
 *   npx tsx scripts/reanalyzeNews.ts --days 30              预演
 *   npx tsx scripts/reanalyzeNews.ts --days 30 --write      实际执行
 *   npx tsx scripts/reanalyzeNews.ts --days 30 --write --limit 20
 *   npx tsx scripts/reanalyzeNews.ts --days 30 --write --concurrency 3
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";

interface Options {
  write: boolean;
  days: number | null;
  limit: number | null;
  concurrency: number;
  includeArxiv: boolean;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    write: false,
    days: null,
    limit: null,
    concurrency: 2,
    includeArxiv: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") o.write = true;
    else if (a === "--include-arxiv") o.includeArxiv = true;
    else if (a === "--days") o.days = Number(argv[++i]) || null;
    else if (a === "--limit") o.limit = Number(argv[++i]) || null;
    else if (a === "--concurrency") o.concurrency = Math.max(1, Number(argv[++i]) || 2);
  }

  return o;
}

const BACKUP_DIR = "backup/reanalysis";

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // 动态 import：@/lib/ai-summary 在模块顶层读 DEEPSEEK_API_KEY，
  // 必须等 dotenv 执行完再加载，否则 client 为 null 会静默走兜底模板。
  const { prisma } = await import("@/lib/prisma");
  const { generateSummary, isAIConfigured } = await import("@/lib/ai-summary");

  console.log("=".repeat(60));
  console.log(opts.write ? "重新分析新闻（写库）" : "重新分析新闻（预演，不写库）");
  console.log("=".repeat(60));
  console.log("");

  if (opts.write && !isAIConfigured()) {
    console.error("✗ 模型未配置，已中止");
    process.exit(1);
  }

  // ---------- 查询范围 ----------
  const where: Record<string, unknown> = { analysisStatus: "completed" };

  if (opts.days) {
    where.publishedAt = { gt: new Date(Date.now() - opts.days * 86_400_000) };
  }

  const rows = await prisma.news.findMany({
    where,
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
      source: true,
      impact: true,
      insight: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  const isArxiv = (s: string | null) => /arxiv/i.test(s || "");

  const queue = rows
    .filter((r) => opts.includeArxiv || !isArxiv(r.source))
    .slice(0, opts.limit ?? rows.length);

  const formulaic = queue.filter((r) => /^对\s*AI\s*产业而言/.test((r.impact || "").trim())).length;

  console.log(`  已分析记录（范围内）: ${rows.length}`);
  console.log(`  排除 arXiv:           ${rows.length - rows.filter((r) => !isArxiv(r.source)).length}`);
  console.log(`  本次处理:             ${queue.length}`);
  console.log(`  其中 impact 公式化:   ${formulaic}（${((formulaic * 100) / Math.max(1, queue.length)).toFixed(0)}%）`);
  console.log("");

  if (queue.length === 0) {
    console.log("  ✓ 无待处理记录");
    await prisma.$disconnect();
    return;
  }

  // 成本估算：输入约 800 token，输出约 900 token
  const cost = (queue.length * 800) / 1e6 + (queue.length * 900 * 2) / 1e6;
  console.log(`  预计费用: 约 ¥${cost.toFixed(2)}`);
  console.log(`  预计耗时: 约 ${Math.round((queue.length * 9) / 60)} 分钟（按每条 9 秒）`);
  console.log("");

  if (!opts.write) {
    console.log("  预演模式。抽样 5 条展示待处理的记录：");
    console.log("");
    for (const r of queue.slice(0, 5)) {
      console.log(`    id=${r.id}  ${(r.title || "").slice(0, 52)}`);
      console.log(`      旧 impact: ${(r.impact || "(空)").slice(0, 60)}`);
    }
    console.log("");
    console.log("  确认无误后加 --write 执行");
    await prisma.$disconnect();
    return;
  }

  // ---------- 开始写库 ----------
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
        const result = await generateSummary(news.title, news.content || news.summary || "");

        // 先备份旧分析，再写新值
        fs.writeFileSync(
          path.join(BACKUP_DIR, `${news.id}.json`),
          JSON.stringify(
            {
              id: news.id,
              title: news.title,
              old: {
                impact: news.impact,
                insight: news.insight,
                summary: news.summary,
              },
              new: {
                impact: result.impact,
                insight: result.insight,
              },
              at: new Date().toISOString(),
            },
            null,
            2,
          ),
        );

        /**
         * 只更新分析字段。
         *
         * 刻意不写这些：
         *   title / titleZh   —— 已生成的翻译不能被覆盖
         *   content           —— 正文是抓取来的，重写会丢失原始信息
         *   summary           —— 已用于中文标题回填的语境，保持稳定
         *   sourceUrl / publishedAt / source —— 事实性字段
         */
        await prisma.news.update({
          where: { id: news.id },
          data: {
            background: result.background,
            insight: result.insight,
            impact: result.impact,
            businessOpportunity: result.businessOpportunity,
            investmentView: result.investmentView,
            aiScore: result.aiScore,
          },
        });

        done++;

        if (done % 20 === 0 || done === queue.length) {
          const el = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
          console.log(`  进度 ${done}/${queue.length}（失败 ${failed}）｜已用 ${el} 分钟`);
        }
      } catch (e) {
        failed++;
        console.error(`  ✗ id=${news.id}: ${String(e).slice(0, 100)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(opts.concurrency, queue.length) }, () => worker()));

  const mins = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);

  console.log("");
  console.log("=".repeat(60));
  console.log("完成");
  console.log("=".repeat(60));
  console.log("");
  console.log(`  成功: ${done}`);
  console.log(`  失败: ${failed}`);
  console.log(`  耗时: ${mins} 分钟`);
  console.log(`  旧分析已备份到: ${BACKUP_DIR}/`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
