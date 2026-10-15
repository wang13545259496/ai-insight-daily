#!/usr/bin/env node
/**
 * 修正 InfoQ 中文 的未来时间戳（减 8 小时）。
 *
 * 依据（上一轮实测确认）：
 *   InfoQ 的 RSS 把北京时间标注为 GMT，pubDate 的小时数等于北京时间的小时数，
 *   即源站少减了 8 小时，导致入库时间比真实时刻晚 8 小时。
 *
 *   验证样例：pubDate "Thu, 15 Oct 2026 15:07:00 GMT"，
 *   抓取时北京时间 15:44 —— 该文章不可能在 15:07 GMT（=北京 23:07）发布，
 *   但「15:07 北京时间」与抓取时刻完全合理。
 *
 * 处理：只修正时间晚于当前时刻的记录，统一减 8 小时。
 *   不全量减，因为只有未来时间才确定存在偏移；
 *   过去时间的记录无法判断是否也受影响。
 *
 * 用法：
 *   node fix-infoq-dates.cjs          # 预览
 *   node fix-infoq-dates.cjs --apply  # 写入
 */
const { DatabaseSync } = require("node:sqlite");

const APPLY = process.argv.includes("--apply");
const OFFSET_MS = 8 * 60 * 60 * 1000;

const db = new DatabaseSync("prisma/dev.db");

const now = Date.now();

console.log("=".repeat(76));
console.log("修正 InfoQ 未来时间戳" + (APPLY ? "（写入模式）" : "（预览模式）"));
console.log("=".repeat(76));
console.log("");
console.log("  当前时间: " + new Date(now).toLocaleString("zh-CN", { hour12: false }));
console.log("");

const rows = db
  .prepare(
    "SELECT id, title, publishedAt, source FROM News WHERE dataStatus='active' AND publishedAt > ? ORDER BY publishedAt DESC",
  )
  .all(now);

console.log("  未来时间记录: " + rows.length + " 条");
console.log("");

if (rows.length === 0) {
  console.log("  无需修正。");
  db.close();
  process.exit(0);
}

for (const r of rows) {
  const oldTs = Number(r.publishedAt);
  const newTs = oldTs - OFFSET_MS;

  console.log("  #" + r.id + "  [" + r.source + "]");
  console.log("    " + String(r.title).slice(0, 54));
  console.log(
    "    原: " + new Date(oldTs).toLocaleString("zh-CN", { hour12: false }) +
      "  →  新: " + new Date(newTs).toLocaleString("zh-CN", { hour12: false }),
  );

  // 校验：修正后应早于当前时刻
  const stillFuture = newTs > now;

  if (stillFuture) {
    console.log(
      "    ⚠ 修正后仍为未来（+" + ((newTs - now) / 3600000).toFixed(2) + "h），跳过",
    );
    continue;
  }

  if (APPLY) {
    db.prepare("UPDATE News SET publishedAt = ? WHERE id = ?").run(newTs, r.id);
    console.log("    ✓ 已写入");
  }

  console.log("");
}

if (APPLY) {
  console.log("=".repeat(76));
  console.log("修正后状态");
  console.log("=".repeat(76));
  console.log("");

  const left = db
    .prepare("SELECT COUNT(*) c FROM News WHERE dataStatus='active' AND publishedAt > ?")
    .get(Date.now()).c;

  console.log("  剩余未来时间记录: " + left + " 条");
  console.log("");

  // InfoQ 的时间范围
  const stat = db
    .prepare(
      "SELECT COUNT(*) c, MIN(publishedAt) mn, MAX(publishedAt) mx FROM News WHERE dataStatus='active' AND source LIKE '%InfoQ%'",
    )
    .get();

  console.log("  InfoQ 中文: " + stat.c + " 条");
  console.log(
    "    时间范围: " +
      new Date(Number(stat.mn)).toLocaleDateString("zh-CN") +
      " → " +
      new Date(Number(stat.mx)).toLocaleString("zh-CN", { hour12: false }),
  );
} else {
  console.log("  这是预览模式，未写入。确认后加 --apply：");
  console.log("    node scripts/fix-infoq-dates.cjs --apply");
}

db.close();
