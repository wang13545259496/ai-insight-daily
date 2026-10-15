// @ts-nocheck
/**
 * 试点：对元描述式摘要的新闻，补全正文后重新生成摘要并对比。
 *
 * 默认只预览、不写库，便于先看效果再决定是否全量。
 * 加 --apply 才会写入数据库。
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/pilot-resummary.ts          # 预览
 *   npx tsx --env-file=.env.local scripts/pilot-resummary.ts --apply  # 写入
 */
import { DatabaseSync } from "node:sqlite";

import { prisma } from "@/lib/prisma";
import { extractArticleBody } from "@/lib/news/articleBody";
import { generateSummary } from "@/lib/ai-summary";

const APPLY = process.argv.includes("--apply");
const LIMIT = Number(process.env.PILOT_LIMIT || 8);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 抓取文章正文 */
async function fetchBody(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" },
    });

    if (!res.ok) return null;

    return extractArticleBody(await res.text(), url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 判断摘要是否为元描述式 */
function isMetaDescriptive(summary: string): boolean {
  return /新闻标题为|正文仅|正文内容缺失|发布了一篇题为|该新闻围绕/.test(String(summary || ""));
}

async function main() {
  console.log("=".repeat(90));
  console.log(`试点：补全正文后重新生成摘要（${APPLY ? "写入模式" : "预览模式，不写库"}）`);
  console.log("=".repeat(90));

  const db = new DatabaseSync("prisma/dev.db", { readOnly: true });

  // 取元描述特征最明显的、且有链接的
  const targets = db
    .prepare(
      `SELECT id, title, summary, content, source, sourceUrl, aiScore
       FROM News
       WHERE dataStatus = 'active'
         AND sourceUrl IS NOT NULL
         AND (summary LIKE '%新闻标题为%' OR summary LIKE '%正文仅%'
              OR summary LIKE '%发布了一篇题为%' OR summary LIKE '%正文内容缺失%')
       ORDER BY length(content) ASC
       LIMIT ?`,
    )
    .all(LIMIT);

 db.close();

  console.log(`\n选中 ${targets.length} 条（正文最短的优先）\n`);

  let improved = 0;
  let failed = 0;
  const results: Array<{ id: number; before: string; after: string; ok: boolean }> = [];

  for (const item of targets) {
    console.log("-".repeat(90));
    console.log(`#${item.id} [${item.source}] 原正文 ${String(item.content).length} 字`);
    console.log(`标题: ${String(item.title).slice(0, 70)}`);
    console.log(`原摘要(${String(item.summary).length}字): ${String(item.summary).slice(0, 130)}…`);

    // ---------- 1. 补全正文 ----------
    const body = await fetchBody(String(item.sourceUrl));

    if (!body) {
      console.log(`→ ✗ 正文抓取失败（保持原样）`);
      failed++;
      console.log("");
      continue;
    }

    const newContent = body.length > String(item.content).length ? body : String(item.content);

    console.log(`→ 正文补全: ${String(item.content).length} → ${newContent.length} 字`);

    // ---------- 2. 重新生成摘要 ----------
    let result;

    try {
      result = await generateSummary(String(item.title), newContent);
    } catch (e) {
      console.log(`→ ✗ AI 分析失败: ${String(e).split("\n")[0].slice(0, 60)}`);
      failed++;
      console.log("");
      continue;
    }

    const stillMeta = isMetaDescriptive(result.summary);

    console.log(`→ 新摘要(${result.summary.length}字): ${result.summary.slice(0, 200)}`);
    console.log(`→ 元描述特征: ${stillMeta ? "⚠ 仍存在" : "✓ 已消除"}`);
    console.log(`→ 新洞察: ${String(result.insight).slice(0, 120)}`);

    if (!stillMeta) improved++;

    results.push({ id: item.id, before: item.summary, after: result.summary, ok: !stillMeta });

    // ---------- 3. 可选写入 ----------
    if (APPLY) {
      await prisma.news.update({
        where: { id: item.id },
        data: {
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

      console.log(`→ ✓ 已写入数据库`);
    }

    console.log("");
  }

  console.log("=".repeat(90));
  console.log("试点结果");
  console.log("=".repeat(90));
  console.log(`  处理 ${targets.length} 条｜元描述消除 ${improved} 条｜失败 ${failed} 条`);

  if (targets.length > 0) {
    const rate = ((improved / targets.length) * 100).toFixed(0);
    console.log(`  改善率: ${rate}%`);
    console.log("");
    console.log(
      improved > targets.length * 0.6
        ? "  ✓ 改善显著，建议全量重跑（142 条约 ¥1.88）"
        : "  ⚠ 改善有限，建议先分析失败原因再决定",
    );
  }

  if (!APPLY) {
    console.log("");
    console.log("  这是预览模式，数据库未被修改。");
    console.log("  确认效果后加 --apply 写入：");
    console.log("    npx tsx --env-file=.env.local scripts/pilot-resummary.ts --apply");
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
