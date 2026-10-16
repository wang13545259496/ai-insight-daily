/**
 * 试用新提示词，对比改写前后的效果。
 *
 * 为什么单独写脚本而不直接重跑 analyzeNews：
 * 重跑会覆盖数据库里现有的分析结果。本脚本只调用模型并打印对比，
 * 不写库，便于判断新提示词是否真的更好。
 *
 * 用法：
 *   npx tsx scripts/tryNewPrompt.ts            对比 5 条
 *   npx tsx scripts/tryNewPrompt.ts 10         对比 10 条
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const LIMIT = Number(process.argv[2] || 5);

/** 判断 impact 是否仍以公式化句式开头 */
function isFormulaic(text: string): boolean {
  return /^对\s*AI\s*产业而言/.test((text || "").trim());
}

async function main() {
  /**
   * 必须用动态 import。
   *
   * @/lib/ai-summary 在模块顶层读取 process.env.DEEPSEEK_API_KEY 并创建 client，
   * 若用静态 import，它会在 dotenv.config() 之前求值，client 为 null，
   * 于是所有调用都静默走兜底模板（症状：耗时 0.0s、输出是套话）。
   * 项目里其它脚本同样使用 await import，此处保持一致。
   */
  const { prisma } = await import("@/lib/prisma");
  const { generateSummary, isAIConfigured } = await import("@/lib/ai-summary");

  if (!isAIConfigured()) {
    console.error("✗ 模型未配置（DEEPSEEK_API_KEY 未生效），结果会是兜底模板，已中止");
    process.exit(1);
  }

  // 取近期有完整正文的记录
  const rows = await prisma.news.findMany({
    where: {
      analysisStatus: "completed",
      content: { not: "" },
    },
    select: {
      id: true,
      title: true,
      content: true,
      insight: true,
      impact: true,
      businessOpportunity: true,
    },
    orderBy: { publishedAt: "desc" },
    take: LIMIT,
  });

  console.log("=".repeat(64));
  console.log("新提示词效果对比（不写数据库）");
  console.log("=".repeat(64));

  let oldFormulaic = 0;
  let newFormulaic = 0;

  for (const r of rows) {
    if (isFormulaic(r.impact || "")) oldFormulaic++;

    console.log("");
    console.log("─".repeat(64));
    console.log(`id=${r.id}  ${(r.title || "").slice(0, 50)}`);
    console.log("─".repeat(64));

    console.log("");
    console.log("【旧 impact】");
    console.log(`  ${(r.impact || "(空)").slice(0, 220)}`);
    console.log(`  → 公式化开头: ${isFormulaic(r.impact || "") ? "是 ✗" : "否 ✓"}`);

    const started = Date.now();

    const result = await generateSummary(r.title, r.content || "");

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    console.log("");
    console.log(`【新 impact】（${elapsed}s）`);
    console.log(`  ${(result.impact || "(空)").slice(0, 220)}`);
    console.log(`  → 公式化开头: ${isFormulaic(result.impact) ? "是 ✗" : "否 ✓"}`);

    if (isFormulaic(result.impact)) newFormulaic++;

    console.log("");
    console.log("【旧 insight】");
    console.log(`  ${(r.insight || "(空)").slice(0, 180)}`);
    console.log("");
    console.log("【新 insight】");
    console.log(`  ${(result.insight || "(空)").slice(0, 180)}`);

    console.log("");
    console.log("【新 businessOpportunity】");
    console.log(`  ${(result.businessOpportunity || "(空)").slice(0, 180)}`);

    console.log("");
    console.log(
      `  长度对比  impact ${(r.impact || "").length} → ${result.impact.length}    ` +
        `insight ${(r.insight || "").length} → ${result.insight.length}`,
    );
  }

  console.log("");
  console.log("=".repeat(64));
  console.log("汇总");
  console.log("=".repeat(64));
  console.log("");
  console.log(`  公式化开头：旧 ${oldFormulaic}/${rows.length}  →  新 ${newFormulaic}/${rows.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("失败:", e);
  process.exit(1);
});
