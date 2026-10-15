#!/usr/bin/env node
/**
 * 修复 OpenAI 博客的 publishedAt（用 RSS 的真实发布时间回填）。
 *
 * 问题：库内 1249 条 OpenAI 文章的 publishedAt 等于 createdAt（入库时刻），
 *       真实发布时间缺失，导致：
 *         · 11 年前的老文章被标为 2026-09
 *         · 绕过 ingest 的 30 天窗口过滤，全部入库
 *
 * 方案：拉取 OpenAI RSS（1293 条，含真实 pubDate），按 URL 匹配回填。
 *
 * 用法：
 *   node fix-openai-dates.cjs          # 预览
 *   node fix-openai-dates.cjs --apply  # 写入
 */
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { execSync } = require("child_process");

const APPLY = process.argv.includes("--apply");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function main() {
  console.log("=".repeat(76));
  console.log("修复 OpenAI 博客的 publishedAt" + (APPLY ? "（写入模式）" : "（预览模式）"));
  console.log("=".repeat(76));
  console.log("");

  // ---------- 1. 拉 RSS ----------
  console.log("[1] 拉取 OpenAI RSS...");

  const res = await fetch("https://openai.com/news/rss.xml", { headers: { "User-Agent": UA } });

  if (!res.ok) {
    console.error("  ✗ HTTP " + res.status);
    process.exit(1);
  }

  const xml = await res.text();

  // ---------- 2. 解析出 link -> pubDate ----------
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "";
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";

    const url = link.trim().replace(/<!\[CDATA\[|\]\]>/g, "");
    const dateStr = pub.trim();

    if (!url || !dateStr) continue;

    const ts = new Date(dateStr).getTime();

    if (!Number.isFinite(ts) || ts <= 0) continue;

    items.push({ url, ts, title: title.replace(/<!\[CDATA\[|\]\]>/g, "").trim().slice(0, 50) });
  }

  console.log("  解析出 " + items.length + " 条（含真实发布时间）");

  // 按 URL 建索引（去掉尾部斜杠统一）
  const byUrl = new Map();

  for (const it of items) {
    byUrl.set(it.url.replace(/\/$/, ""), it);
  }

  // ---------- 3. 读库内记录 ----------
  console.log("");
  console.log("[2] 读取库内 OpenAI 记录...");

  const db = new DatabaseSync("prisma/dev.db");

  const rows = db
    .prepare(
      "SELECT id, title, sourceUrl, publishedAt, createdAt FROM News WHERE source = ? AND dataStatus = ?",
    )
    .all("OpenAI 官方博客", "active");

  console.log("  库内 " + rows.length + " 条");

  // ---------- 4. 匹配 ----------
  console.log("");
  console.log("[3] 匹配并计算修正...");

  const fixes = [];
  let noUrl = 0;
  let noMatch = 0;
  let alreadyOk = 0;

  for (const r of rows) {
    const url = String(r.sourceUrl || "").replace(/\/$/, "");

    if (!url) {
      noUrl++;
      continue;
    }

    const hit = byUrl.get(url);

    if (!hit) {
      noMatch++;
      continue;
    }

    const cur = Number(r.publishedAt);

    // 时间差超过 1 天才需要修
    if (Math.abs(cur - hit.ts) < 86400000) {
      alreadyOk++;
      continue;
    }

    fixes.push({
      id: r.id,
      title: String(r.title).slice(0, 42),
      oldTs: cur,
      newTs: hit.ts,
    });
  }

  console.log("  需要修正:   " + fixes.length + " 条");
  console.log("  时间已正确: " + alreadyOk + " 条");
  console.log("  RSS 中无匹配: " + noMatch + " 条（可能是旧文章，已从 RSS 移除）");
  console.log("  无 URL:      " + noUrl + " 条");

  // ---------- 5. 展示修正样例 ----------
  if (fixes.length > 0) {
    console.log("");
    console.log("[4] 修正样例（前 10 条）:");
    console.log("");
    console.log("  ID      原标题                                     原时间 → 新时间");

    for (const f of fixes.slice(0, 10)) {
      const oldStr = new Date(f.oldTs).toLocaleDateString("zh-CN");
      const newStr = new Date(f.newTs).toLocaleDateString("zh-CN");

      console.log(
        "  " +
          String(f.id).padStart(6) +
          "  " +
          f.title.padEnd(42) +
          "  " +
          oldStr +
          " → " +
          newStr,
      );
    }

    // 新时间的年份分布
    const byYear = {};

    for (const f of fixes) {
      const y = new Date(f.newTs).getFullYear();
      byYear[y] = (byYear[y] || 0) + 1;
    }

    console.log("");
    console.log("  修正后按年份分布:");
    for (const [y, n] of Object.entries(byYear).sort()) {
      console.log("    " + y + "  " + String(n).padStart(5) + "  " + "#".repeat(Math.min(40, Math.round(n / 10))));
    }
  }

  // ---------- 6. 写入 ----------
  if (APPLY && fixes.length > 0) {
    console.log("");
    console.log("[5] 写入数据库...");

    // News 表没有 updatedAt 列，只更新 publishedAt
    const stmt = db.prepare("UPDATE News SET publishedAt = ? WHERE id = ?");

    let done = 0;

    for (const f of fixes) {
      try {
        stmt.run(f.newTs, f.id);
        done++;
      } catch (e) {
        console.error("  ✗ id=" + f.id + " " + String(e).slice(0, 60));
      }
    }

    console.log("  ✓ 已更新 " + done + " 条");
  } else if (!APPLY) {
    console.log("");
    console.log("  这是预览模式，未写入。确认后加 --apply：");
    console.log("    node scripts/fix-openai-dates.cjs --apply");
  }

  // ---------- 7. 修复后状态 ----------
  if (APPLY) {
    console.log("");
    console.log("[6] 修复后状态:");

    const after = db
      .prepare(
        "SELECT COUNT(*) c, MIN(publishedAt) mn, MAX(publishedAt) mx FROM News WHERE source = ? AND dataStatus = ?",
      )
      .get("OpenAI 官方博客", "active");

    console.log("  条数: " + after.c);
    console.log("  时间范围: " + new Date(Number(after.mn)).toLocaleDateString("zh-CN") + " → " + new Date(Number(after.mx)).toLocaleDateString("zh-CN"));

    const recent = db
      .prepare(
        "SELECT COUNT(*) c FROM News WHERE source = ? AND dataStatus = ? AND publishedAt >= ?",
      )
      .get("OpenAI 官方博客", "active", Date.now() - 30 * 86400000);

    console.log("  近 30 天内发布: " + recent.c + " 条（这才是应入库的量）");
  }

  db.close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("失败: " + String(e).slice(0, 300));
  process.exit(1);
});
