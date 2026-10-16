/**
 * 补齐 publishedAt 为空的记录（21 条）。
 *
 * 问题：这 21 条没有发布时间，按 publishedAt 排序时会落到列表最底部，
 * 读者在「AI资讯」里永远看不到它们。
 *
 * 两类来源，处理方式不同：
 *
 *   1. DeepSeek 文档动态（15 条）
 *      逐篇抓取文章页，从 <article> 正文里读取真实日期
 *      （如 news250120 的正文含 2025/01/20）。
 *
 *      **刻意不用 URL slug 推断日期** —— slug 有 MMDD（news1226）
 *      与 YYMMDD（news250120）两种格式，靠长度猜年份会错。
 *      也**刻意不用侧栏** —— 侧栏列的是其它文章的链接，
 *      其日期与当前页 slug 的对应关系不可靠（实测配错过）。
 *
 *   2. OpenAI 官方博客（6 条）
 *      openai.com 对本环境返回 403，拿不到真实发布日期。
 *      退用 createdAt（入库时间）作为近似，并在输出里明确标注，
 *      便于日后有真实来源时更正。
 *
 * 用法：
 *   npx tsx scripts/fixNullPublishedAt.ts --dry-run
 *   npx tsx scripts/fixNullPublishedAt.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * 从单篇文章页读取发布日期。
 *
 * 只取 <article> 范围内的日期，避开侧栏与页脚 ——
 * 那些位置的日期属于其它文章。
 */
async function fetchArticleDate(url: string): Promise<Date | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });

    if (!res.ok) return null;

    const html = await res.text();

    const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);

    const scope = article ? article[1] : html;

    const m = scope.match(/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})/);

    if (!m) return null;

    // 用 UTC 中午，避免时区导致日期偏移一天
    const date = new Date(
      Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0),
    );

    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { prisma } = await import("@/lib/prisma");

  console.log("=".repeat(62));
  console.log("补齐 publishedAt 为空的记录");
  console.log("=".repeat(62));
  console.log("");

  const rows = await prisma.news.findMany({
    where: { publishedAt: null },
    select: {
      id: true,
      title: true,
      source: true,
      sourceUrl: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });

  console.log(`  待处理: ${rows.length} 条`);
  console.log("");

  const exact: Array<{ id: number; date: Date; url: string }> = [];
  const approx: Array<{ id: number; date: Date }> = [];
  const failed: number[] = [];

  for (const r of rows) {
    const url = r.sourceUrl || "";

    // 只对 DeepSeek 文档尝试抓取；OpenAI 已知 403，不浪费请求
    const isDeepSeekDoc = /api-docs\.deepseek\.com/i.test(url);

    if (isDeepSeekDoc) {
      if (dryRun) {
        // 预演也抓，以便确认映射正确
        const d = await fetchArticleDate(url);

        if (d) {
          exact.push({ id: r.id, date: d, url });
        } else {
          failed.push(r.id);
        }

        continue;
      }

      const d = await fetchArticleDate(url);

      if (d) {
        exact.push({ id: r.id, date: d, url });
        continue;
      }

      failed.push(r.id);
      continue;
    }

    // OpenAI 及其它：用 createdAt 近似
    if (r.createdAt) {
      approx.push({ id: r.id, date: r.createdAt });
    } else {
      failed.push(r.id);
    }
  }

  console.log(`  ✓ 真实日期（读文章正文）: ${exact.length} 条`);
  for (const e of exact) {
    const slug = e.url.split("/").filter(Boolean).pop() ?? "(无 slug)";
    console.log(`      id=${e.id}  ${slug.padEnd(12)} → ${e.date.toISOString().slice(0, 10)}`);
  }

  console.log("");
  console.log(`  ≈ 近似值（createdAt，openai.com 返回 403）: ${approx.length} 条`);
  if (approx.length > 0) {
    const d = approx[0].date.toISOString().slice(0, 10);
    console.log(`      统一取入库时间 ${d}`);
    console.log(`      ⚠ 这是近似值，非真实发布日期`);
  }

  if (failed.length > 0) {
    console.log("");
    console.log(`  ✗ 未取到: ${failed.length} 条 → ${failed.join(", ")}`);
  }

  if (dryRun) {
    console.log("");
    console.log("  预演模式，未写库");
    await prisma.$disconnect();
    return;
  }

  let written = 0;

  for (const e of [...exact, ...approx]) {
    try {
      await prisma.news.update({
        where: { id: e.id },
        data: { publishedAt: e.date },
      });
      written++;
    } catch (err) {
      console.error(`  ✗ id=${e.id}: ${String(err).slice(0, 80)}`);
    }
  }

  console.log("");
  console.log(`  已写入: ${written} 条`);

  const remain = await prisma.news.count({ where: { publishedAt: null } });
  console.log(`  仍为空: ${remain} 条`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
