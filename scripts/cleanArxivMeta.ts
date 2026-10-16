/**
 * 清洗 arXiv 抓取时残留的元信息。
 *
 * 问题：arXiv 来源的正文被原样存入库，开头带着
 *   「arXiv:2610.19210v1 Announce Type: new Abstract: 」
 * 这类出版元信息，在页面上直接展示给读者。
 * 实测全库 66 条受影响，其中 60 条的 content 与 summary 完全相同
 * （即原始摘要被当作摘要使用）。
 *
 * 清洗策略（刻意保守）：
 *
 *   · **只删明确是元信息的片段** —— 「arXiv:ID」「Announce Type: xxx」
 *     「Abstract:」。这些是 arXiv 的投稿系统字段，不是论文内容。
 *   · **保留 arXiv ID 的语义** —— 不直接丢弃，而是把
 *     「arXiv:2610.19210v1 Announce Type: new Abstract: Transformers...」
 *     变成「[arXiv:2610.19210v1] Transformers...」，
 *     读者仍能据此找到原文，便于核对。
 *   · **不碰正文其它部分** —— 不做摘要压缩、不翻译，那是分析阶段的事。
 *   · **只处理匹配到的记录**，且清洗后长度必须变短、不能变空，
 *     否则跳过并报告。
 *
 * 用法：
 *   npx tsx scripts/cleanArxivMeta.ts --dry-run
 *   npx tsx scripts/cleanArxivMeta.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";

const BACKUP_DIR = "backup/arxiv-clean";

/**
 * 把 arXiv 元信息前缀改写为简洁的 ID 标注。
 *
 * 输入示例：
 *   arXiv:2610.19210v1 Announce Type: new Abstract: Transformers are...
 *   arXiv:2610.14005v1 Announce Type: replace-cross Abstract: ...
 * 输出：
 *   [arXiv:2610.19210v1] Transformers are...
 */
function cleanArxivPrefix(text: string): { out: string; changed: boolean } {
  const original = text;

  let out = text;

  // 1. 匹配开头的 arXiv 元信息：ID + Announce Type + Abstract
  const metaRe =
    /^\s*arXiv:\s*([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)\s*Announce\s+Type:\s*[\w-]+\s*Abstract:\s*/i;

  const m = out.match(metaRe);

  if (m) {
    out = `[arXiv:${m[1]}] ` + out.slice(m[0].length);
  } else {
    // 2. 变体：只有 arXiv:ID 开头
    const idOnly = out.match(/^\s*arXiv:\s*([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)\s+/i);

    if (idOnly) {
      out = `[arXiv:${idOnly[1]}] ` + out.slice(idOnly[0].length);
    } else {
      // 3. 变体：含 Announce Type 但无 Abstract 标签
      const at = out.match(/^\s*(.*?)Announce\s+Type:\s*[\w-]+\s*/i);

      if (at && at[1].length < 60) {
        out = out.slice(at[0].length);
        // 若剩余部分以 Abstract: 开头也去掉
        out = out.replace(/^\s*Abstract:\s*/i, "");
      }
    }
  }

  // 4. 中间残留的转义与空引用（arXiv 摘要常见）
  out = out
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return { out, changed: out !== original };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { prisma } = await import("@/lib/prisma");

  console.log("=".repeat(60));
  console.log("清洗 arXiv 元信息");
  console.log("=".repeat(60));
  console.log("");

  const rows = await prisma.news.findMany({
    where: {
      OR: [
        { content: { contains: "Announce Type" } },
        { content: { startsWith: "arXiv:" } },
        { summary: { contains: "Announce Type" } },
      ],
    },
    select: { id: true, title: true, source: true, content: true, summary: true },
  });

  console.log(`  命中记录: ${rows.length}`);
  console.log("");

  let changed = 0;
  let skipped = 0;
  const samples: Array<{ id: number; before: string; after: string }> = [];

  if (!dryRun) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  for (const r of rows) {
    const c = cleanArxivPrefix(r.content || "");
    const s = cleanArxivPrefix(r.summary || "");

    if (!c.changed && !s.changed) {
      skipped++;
      continue;
    }

    // 安全性：清洗后不能为空，且必须变短
    const contentOk = c.out.length > 20 && c.out.length < (r.content || "").length;
    const summaryOk = !s.changed || (s.out.length > 20 && s.out.length < (r.summary || "").length);

    if (!contentOk || !summaryOk) {
      console.log(`  ⚠ id=${r.id} 清洗结果异常，跳过`);
      skipped++;
      continue;
    }

    if (samples.length < 3) {
      samples.push({
        id: r.id,
        before: (r.content || "").slice(0, 100),
        after: c.out.slice(0, 100),
      });
    }

    if (!dryRun) {
      fs.writeFileSync(
        path.join(BACKUP_DIR, `${r.id}.json`),
        JSON.stringify(
          { id: r.id, content: r.content, summary: r.summary, at: new Date().toISOString() },
          null,
          2,
        ),
      );

      await prisma.news.update({
        where: { id: r.id },
        data: {
          content: c.out,
          // summary 与 content 原本相同时，一并更新，保持两者一致
          ...(s.changed ? { summary: s.out } : {}),
        },
      });
    }

    changed++;
  }

  console.log("  改写示例:");
  for (const s of samples) {
    console.log("");
    console.log(`    id=${s.id}`);
    console.log(`      前: ${s.before}`);
    console.log(`      后: ${s.after}`);
  }

  console.log("");
  console.log(`  已清洗: ${changed}`);
  console.log(`  跳过:   ${skipped}`);

  if (dryRun) {
    console.log("");
    console.log("  预演模式，未写库");
  } else {
    console.log(`  旧值备份: ${BACKUP_DIR}/`);

    const remain = await prisma.news.count({
      where: {
        OR: [
          { content: { contains: "Announce Type" } },
          { content: { startsWith: "arXiv:" } },
        ],
      },
    });
    console.log(`  仍含元信息: ${remain} 条`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
