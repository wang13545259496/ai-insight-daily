/**
 * 阶段 4：把实体关联到新闻（NewsEntity）。
 *
 * 两种来源，用 role 字段区分，便于日后筛选或撤销：
 *
 *   1. 直接匹配（role = subject / background）
 *      在新闻的标题、摘要、正文中查找实体名。
 *      实体本身就抽自新闻正文（阶段 2 校验过「必须逐字出现」），
 *      所以这里是确定性匹配，不调模型、免费、可复现。
 *
 *   2. 事件继承（role = event）
 *      新闻若归属某个事件（eventId 非空），继承该事件的实体。
 *      理由：事件实体已经过分级加权筛选（linkEventEntities.ts），
 *      质量较高；把新闻归到这些实体下，能让实体页显示更多相关内容。
 *
 *      刻意用不同的 role 标记 —— 「这篇文章提到了 X」与
 *      「这篇文章所属的事件涉及 X」是两回事，混在一起会让
 *      实体页出现看似相关、实际未提及的条目。
 *
 * 分级加权（避免噪声）：
 *   标题出现  +5   → 该实体是文章主体
 *   摘要出现  +3
 *   正文出现  +1（每次，上限 5）
 *
 *   新闻是单一主题，正文里被提到的实体通常确实相关，
 *   因此阈值设为 1（出现即关联）。这与事件不同 ——
 *   事件聚合 30 篇新闻，任何被提及的都算会噪声过大。
 *
 * 用法：
 *   npx tsx scripts/linkNewsEntities.ts --dry-run
 *   npx tsx scripts/linkNewsEntities.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const WEIGHT = {
  title: 5,
  summary: 3,
  contentEach: 1,
  contentCap: 5,
} as const;

/** 单篇新闻最多关联多少个实体，防止长文异常 */
const MAX_PER_NEWS = 25;

/** 从 |a|b| 取别名 */
function pickAliases(aliases: string): string[] {
  return aliases
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/**
 * 统计 needle 在 text 中出现的次数。
 *
 * 纯 ASCII 用词边界（避免 Apple 命中 Appleby）；
 * 中文直接包含匹配（\b 对中文无效）。
 */
function countIn(text: string, needle: string): number {
  if (!needle || needle.length < 2) return 0;

  if (/^[\x20-\x7E]+$/.test(needle)) {
    const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`, "gi");
    let n = 0;
    while (re.exec(text) !== null) {
      n++;
      if (n > 20) break;
    }
    return n;
  }

  let n = 0;
  let idx = text.indexOf(needle);
  while (idx !== -1 && n <= 20) {
    n++;
    idx = text.indexOf(needle, idx + needle.length);
  }
  return n;
}

interface Link {
  entityId: number;
  name: string;
  type: string;
  mentions: number;
  role: string;
  score: number;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  /**
   * 是否启用事件继承，默认关闭。
   *
   * 实测：事件聚合多篇新闻，一篇新闻属于某事件不等于它与该事件的
   * 所有主体相关。启用后会引入明显噪声（详见提交记录）。
   * 保留开关是为了将来有更细粒度的事件-新闻关系时再用。
   */
  const useInherit = process.argv.includes("--inherit");

  const { prisma } = await import("@/lib/prisma");

  console.log("=".repeat(62));
  console.log(`阶段 4：关联实体到新闻${dryRun ? "（预演）" : ""}`);
  console.log("=".repeat(62));
  console.log("");

  const entities = await prisma.entity.findMany({
    where: { status: { not: "merged" } },
    select: { id: true, name: true, type: true, aliases: true },
  });

  const news = await prisma.news.findMany({
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      eventId: true,
    },
  });

  console.log(`  实体: ${entities.length}`);
  console.log(`  新闻: ${news.length}`);
  console.log("");

  // 预计算别名，避免每条新闻重复解析
  const index = entities.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    names: [e.name, ...pickAliases(e.aliases)],
  }));

  // 事件 → 实体（用于继承）
  /**
   * 只取**主体实体**（isPrimary）。
   *
   * 预演发现：若继承事件的全部实体，噪声远大于有效信息 ——
   * 事件「OpenAI生态」有 43 个实体、335 篇新闻，全继承等于
   * 每篇新闻多背 42 个无关实体（如 Ringg、Basis 这类投资候选公司）。
   *
   * 主体实体是出现在事件标题里的核心对象，继承它才表达
   * 「这篇新闻与某个主体相关」。全库 176 条关联中 101 条为主体。
   */
  const eventLinks = await prisma.eventEntity.findMany({
    where: { isPrimary: true },
    select: { eventId: true, entityId: true },
  });

  const eventEntities = new Map<number, number[]>();

  for (const l of eventLinks) {
    const arr = eventEntities.get(l.eventId) ?? [];
    arr.push(l.entityId);
    eventEntities.set(l.eventId, arr);
  }

  console.log(`  事件主体实体: ${eventLinks.length} 条，覆盖 ${eventEntities.size} 个事件`);
  console.log(
    useInherit
      ? "  事件继承:    已启用（会引入部分噪声，仅调试用）"
      : "  事件继承:    已关闭（默认。理由见脚本注释）",
  );
  console.log("");

  let totalDirect = 0;
  let totalInherited = 0;
  let newsWithLinks = 0;
  let newsWithout = 0;

  const samples: Array<{ id: number; title: string; links: Link[] }> = [];
  const allLinks: Array<{ newsId: number } & Link> = [];

  for (const n of news) {
    const title = n.title || "";
    const summary = n.summary || "";
    const content = (n.content || "").slice(0, 3000);

    const found: Link[] = [];

    for (const e of index) {
      let score = 0;
      let mentions = 0;

      // 标题
      const inTitle = e.names.some((nm) => countIn(title, nm) > 0);
      if (inTitle) score += WEIGHT.title;

      // 摘要
      for (const nm of e.names) {
        mentions += countIn(summary, nm);
      }
      if (mentions > 0) score += WEIGHT.summary;

      // 正文
      let contentHits = 0;
      for (const nm of e.names) {
        contentHits += countIn(content, nm);
      }
      score += Math.min(contentHits, WEIGHT.contentCap) * WEIGHT.contentEach;
      mentions += contentHits;

      if (score <= 0) continue;

      found.push({
        entityId: e.id,
        name: e.name,
        type: e.type,
        mentions: Math.max(1, mentions),
        role: inTitle ? "subject" : "background",
        score,
      });
    }

    // 同名去重（保留得分最高的），与事件关联保持一致的处理
    const bestByName = new Map<string, Link>();
    for (const f of found) {
      const key = f.name.toLowerCase();
      const prev = bestByName.get(key);
      if (!prev || f.score > prev.score) bestByName.set(key, f);
    }

    let links = Array.from(bestByName.values()).sort((a, b) => b.score - a.score);

    // ---------- 事件继承（默认关闭，见 useInherit 说明）----------
    if (useInherit && n.eventId) {
      const inherited = eventEntities.get(n.eventId) ?? [];
      const existing = new Set(links.map((l) => l.entityId));

      for (const eid of inherited) {
        if (existing.has(eid)) continue;

        const e = entities.find((x) => x.id === eid);
        if (!e) continue;

        links.push({
          entityId: eid,
          name: e.name,
          type: e.type,
          mentions: 1,
          role: "event",
          score: 0,
        });
      }
    }

    links = links.slice(0, MAX_PER_NEWS);

    const direct = links.filter((l) => l.role !== "event").length;
    const inherited = links.filter((l) => l.role === "event").length;

    totalDirect += direct;
    totalInherited += inherited;

    if (links.length > 0) newsWithLinks++;
    else newsWithout++;

    if (samples.length < 5 && links.length > 0) {
      samples.push({ id: n.id, title: title.slice(0, 50), links });
    }

    for (const l of links) allLinks.push({ newsId: n.id, ...l });
  }

  console.log("=".repeat(62));
  console.log("统计");
  console.log("=".repeat(62));
  console.log("");
  console.log(`  直接匹配关联:   ${totalDirect}`);
  console.log(`  事件继承关联:   ${totalInherited}`);
  console.log(`  合计:           ${totalDirect + totalInherited}`);
  console.log("");
  console.log(`  有关联的新闻:   ${newsWithLinks} / ${news.length}`);
  console.log(`  无关联的新闻:   ${newsWithout}`);
  console.log(
    `  平均每条:       ${((totalDirect + totalInherited) / news.length).toFixed(2)} 个实体`,
  );

  console.log("");
  console.log("  抽样：");
  for (const s of samples) {
    console.log("");
    console.log(`    id=${s.id}  ${s.title}`);
    console.log(
      `      ${s.links
        .slice(0, 6)
        .map((l) => `${l.name}(${l.role === "event" ? "事件" : l.role === "subject" ? "主体" : "提及"})`)
        .join("  ")}`,
    );
  }

  if (dryRun) {
    console.log("");
    console.log("  预演模式，未写库");
    await prisma.$disconnect();
    return;
  }

  // ---------- 写库 ----------
  console.log("");
  console.log("=== 写入数据库 ===");

  // 先清空：重跑即重建，天然幂等。
  // 同时避开 createMany 的 skipDuplicates —— SQLite 不支持该选项。
  const removed = await prisma.newsEntity.deleteMany({});
  console.log(`  清空已有记录: ${removed.count} 条`);

  const startedAt = Date.now();
  let written = 0;
  let failed = 0;

  // 分批，避免单次事务过大
  const BATCH = 500;

  for (let i = 0; i < allLinks.length; i += BATCH) {
    const batch = allLinks.slice(i, i + BATCH);

    try {
      await prisma.newsEntity.createMany({
        data: batch.map((l) => ({
          newsId: l.newsId,
          entityId: l.entityId,
          mentions: l.mentions,
          role: l.role,
        })),
      });

      written += batch.length;

      if ((i / BATCH) % 4 === 0) {
        const el = ((Date.now() - startedAt) / 1000).toFixed(0);
        console.log(`  已写入 ${written} / ${allLinks.length}（${el}s）`);
      }
    } catch (e) {
      failed += batch.length;
      console.error(`  ✗ 批次失败: ${String(e).slice(0, 100)}`);
    }
  }

  const mins = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log("");
  console.log(`  写入完成: ${written} 条，失败 ${failed}，耗时 ${mins}s`);

  const finalCount = await prisma.newsEntity.count();
  console.log(`  数据库内 NewsEntity: ${finalCount} 条`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
