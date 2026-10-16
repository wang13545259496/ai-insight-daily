/**
 * 阶段 3：把实体关联到事件（按相关度分级）。
 *
 * 为什么不用「出现即关联」：
 * 首版预演发现噪声过大 —— 平均每个事件命中 14 个实体。
 * 原因是事件聚合了最多 30 条新闻，文中任何被提到的实体都会算进来，
 * 包括只在综述里顺带提及的。
 *
 * 改为分级加权：
 *
 *   事件标题    权重 5  —— 标题里出现，基本就是事件主体
 *   事件综述    权重 3
 *   新闻标题    权重 2  —— 每出现一次累加
 *   新闻摘要    权重 1  —— 每出现一次累加，但整条事件最多贡献 5
 *
 * 依据得分判定 isPrimary（>=5，即至少在该事件标题里出现，
 * 或在综述里出现并多次见于新闻标题）。
 *
 * 低于阈值的实体不写入 —— 宁可少关联，也不要让事件页挂满无关标签。
 *
 * 别名匹配：用词边界（纯 ASCII）或包含（中文），避免 Apple 命中 Appleby。
 *
 * 用法：
 *   npx tsx scripts/linkEventEntities.ts --dry-run
 *   npx tsx scripts/linkEventEntities.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/** 各位置的分值 */
const WEIGHT = {
  eventTitle: 5,
  eventSummary: 3,
  newsTitle: 2,
  /** 新闻摘要每次出现 1 分，但单条事件最多累计这么多 */
  newsSummaryEach: 1,
  newsSummaryCap: 5,
} as const;

/** 低于此分不建立关联 */
const MIN_SCORE = 3;

/** 从 |a|b| 形式取出别名 */
function pickAliases(aliases: string): string[] {
  return aliases
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/** 纯 ASCII 用词边界，中文直接包含 */
function countIn(text: string, needle: string): number {
  if (!needle || needle.length < 2) return 0;

  if (/^[\x20-\x7E]+$/.test(needle)) {
    const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`, "gi");
    let n = 0;
    while (re.exec(text) !== null) {
      n++;
      if (n > 50) break;
    }
    return n;
  }

  let n = 0;
  let idx = text.indexOf(needle);
  while (idx !== -1 && n <= 50) {
    n++;
    idx = text.indexOf(needle, idx + needle.length);
  }
  return n;
}

interface Score {
  entityId: number;
  name: string;
  type: string;
  score: number;
  primary: boolean;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { prisma } = await import("@/lib/prisma");

  console.log("=".repeat(62));
  console.log("阶段 3：关联实体到事件（分级加权）");
  console.log("=".repeat(62));
  console.log("");

  const events = await prisma.newsEvent.findMany({
    where: { status: "active" },
    select: {
      id: true,
      title: true,
      summary: true,
      industryScore: true,
      news: {
        select: { title: true, summary: true },
        orderBy: { publishedAt: "desc" },
        take: 30,
      },
    },
    orderBy: { industryScore: "desc" },
  });

  /**
   * 只取未归并的实体。
   *
   * 归并后的记录 status 为 merged、mergedIntoId 指向主记录，
   * 名字与别名已并入主记录 —— 因此它们仍能匹配到文本，
   * 若不排除就会与主记录重复命中，事件页出现两个标签。
   */
  const entities = await prisma.entity.findMany({
    where: { status: { not: "merged" } },
    select: { id: true, name: true, type: true, aliases: true },
  });

  console.log(`  事件: ${events.length}   实体: ${entities.length}`);
  console.log(`  阈值: 得分 >= ${MIN_SCORE}`);
  console.log("");

  let totalKept = 0;
  let totalSkipped = 0;
  let totalPrimary = 0;

  for (const ev of events) {
    const scored: Score[] = [];

    for (const e of entities) {
      const names = [e.name, ...pickAliases(e.aliases)];

      let score = 0;

      // 事件标题
      if (names.some((n) => countIn(ev.title, n) > 0)) score += WEIGHT.eventTitle;

      // 事件综述
      if (names.some((n) => countIn(ev.summary || "", n) > 0)) score += WEIGHT.eventSummary;

      // 新闻标题（每个标题最多算一次）
      let newsTitleHits = 0;
      let summaryHits = 0;

      for (const n of ev.news) {
        if (names.some((x) => countIn(n.title, x) > 0)) newsTitleHits++;

        for (const x of names) {
          summaryHits += Math.min(2, countIn(n.summary || "", x));
        }
      }

      score += Math.min(newsTitleHits, 30) * WEIGHT.newsTitle;

      // 摘要分设上限，避免一条新闻提很多次就冲高分
      score += Math.min(summaryHits, WEIGHT.newsSummaryCap) * WEIGHT.newsSummaryEach;

      if (score < MIN_SCORE) {
        totalSkipped++;
        continue;
      }

      const primary = score >= WEIGHT.eventTitle;

      scored.push({ entityId: e.id, name: e.name, type: e.type, score, primary });
    }

    // 按名称去重：同名实体（如 [company]GitHub 与 [product]GitHub）
    // 只保留得分最高的那一条，避免事件页出现重复标签。
    //
    // 不合并实体本身 —— 抽取阶段存在类型标注错误（OpenAI Academy 被标成
    // product、Axios 被标成 product），合并会连带丢掉正确的那条。
    // 在展示层去重既让界面干净，又保留各实体自身的类型。
    const bestByName = new Map<string, Score>();
    for (const s of scored) {
      const key = s.name.toLowerCase();
      const prev = bestByName.get(key);
      if (!prev || s.score > prev.score) bestByName.set(key, s);
    }

    const deduped = Array.from(bestByName.values()).sort((a, b) => b.score - a.score);

    totalKept += deduped.length;
    totalPrimary += deduped.filter((s) => s.primary).length;
    totalSkipped += scored.length - deduped.length;

    const top = deduped.slice(0, 6).map((s) => `${s.name}(${s.score})`).join("  ");
    const prim = deduped.filter((s) => s.primary).map((s) => s.name);

    console.log(`  id=${String(ev.id).padStart(4)}  保留 ${String(deduped.length).padStart(3)}` +
      (scored.length > deduped.length ? `（同名去重 ${scored.length - deduped.length}）` : ""));
    console.log(`        主体: ${prim.length > 0 ? prim.slice(0, 5).join(" / ") : "（无）"}`);
    console.log(`        高分: ${top}`);

    if (!dryRun) {
      for (const s of deduped) {
        try {
          await prisma.eventEntity.create({
            data: { eventId: ev.id, entityId: s.entityId, isPrimary: s.primary },
          });
        } catch {
          // 唯一约束冲突，跳过
        }
      }
    }
  }

  console.log("");
  console.log(`  保留关联:   ${totalKept}`);
  console.log(`  其中主体:   ${totalPrimary}`);
  console.log(`  低于阈值丢弃: ${totalSkipped}`);

  if (dryRun) {
    console.log("");
    console.log("  预演完成，未写库");
  } else {
    const final = await prisma.eventEntity.count();
    console.log(`  已写入 EventEntity: ${final} 条`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
