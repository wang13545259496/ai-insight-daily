/**
 * 实体归并：把同一实体的不同写法合并到一条记录。
 *
 * 背景：
 * 抽取阶段对同一实体产生了多条记录 ——
 *   谷歌 / Google / Google DeepMind / DeepMind
 *   GPT / GPT-6 / GPT-6 Astra / Astra
 * 若不归并，事件页会挂满重复标签。
 *
 * 归并的三类（刻意区分，避免误合）：
 *
 *   1. **仅大小写不同** —— 确定是重复（NVIDIA / NVIDIA）。
 *      但类型不同的保留：GitHub 既是公司也是产品，语义不同。
 *
 *   2. **中英对照** —— 用人工确认的映射表（谷歌→Google、微软→Microsoft）。
 *      不做自动翻译猜测，因为「苹果」既可能是 Apple 公司也可能是水果相关词。
 *
 *   3. **明确同义** —— 同样用人工表（Open AI → OpenAI、The Walt Disney
 *      Company → 迪士尼）。
 *
 * **不做的事**：前缀包含关系（Amazon ⊂ Amazon Bedrock）是父子层级，
 * 不是重复，合并会让「亚马逊」与「Amazon Bedrock」混为一谈。
 * 这类关系留待后续用 parentId 表达。
 *
 * 归并方式：被并入的记录 status 置为 merged，mergedIntoId 指向主记录，
 * 别名合并到主记录。**不删除** —— 已建立的关联可追溯。
 *
 * 用法：
 *   npx tsx scripts/mergeEntities.ts --dry-run
 *   npx tsx scripts/mergeEntities.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/**
 * 人工确认的归并表：别名 → 规范名。
 *
 * 只放**确定是同一实体**的映射。宁可少合，不要错合 ——
 * 错合会把两个不同对象的动态混在一起，比不合并更难发现。
 */
const CANONICAL: Array<{ alias: string; canonical: string; type: string }> = [
  // 中英对照：公司
  { alias: "谷歌", canonical: "Google", type: "company" },
  { alias: "微软", canonical: "Microsoft", type: "company" },
  { alias: "苹果", canonical: "Apple", type: "company" },
  { alias: "英伟达", canonical: "NVIDIA", type: "company" },
  { alias: "亚马逊", canonical: "Amazon", type: "company" },
  { alias: "Meta", canonical: "Meta", type: "company" },
  { alias: "字节跳动", canonical: "字节跳动", type: "company" },
  { alias: "腾讯", canonical: "腾讯", type: "company" },
  { alias: "阿里巴巴", canonical: "阿里巴巴", type: "company" },
  { alias: "百度", canonical: "百度", type: "company" },
  { alias: "华为", canonical: "华为", type: "company" },
  { alias: "智谱", canonical: "智谱", type: "company" },

  // 明确同义：公司
  { alias: "Open AI", canonical: "OpenAI", type: "company" },
  { alias: "The Walt Disney Company", canonical: "迪士尼", type: "company" },
  { alias: "Department of Energy", canonical: "U.S. Department of Energy", type: "company" },
  { alias: "DeepMind", canonical: "Google DeepMind", type: "company" },

  // 人物
  { alias: "Elon", canonical: "Elon Musk", type: "person" },

  // 模型
  { alias: "GPT-4o-latest", canonical: "GPT-4o", type: "model" },
];

/** 大小写不同视为重复时，类型的优先级（保留更「实体化」的那个） */
const TYPE_PRIORITY: Record<string, number> = {
  company: 4,
  model: 3,
  product: 2,
  person: 1,
};

function pickAliases(aliases: string): string[] {
  return aliases
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function joinAliases(list: string[]): string {
  const set = new Set(list.filter((s) => s && s.length >= 2));
  return set.size === 0 ? "|" : `|${Array.from(set).join("|")}|`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { prisma } = await import("@/lib/prisma");

  console.log("=".repeat(62));
  console.log("实体归并");
  console.log("=".repeat(62));
  console.log("");

  const all = await prisma.entity.findMany({
    where: { status: { not: "merged" } },
    select: { id: true, name: true, type: true, aliases: true, status: true },
  });

  console.log(`  待检查实体: ${all.length}`);
  console.log("");

  const merges: Array<{ from: number; fromName: string; to: number; toName: string; reason: string }> = [];

  // ---------- 1. 仅大小写不同（同类型内）----------
  const byKey = new Map<string, typeof all>();

  for (const e of all) {
    const k = `${e.name.toLowerCase()}||${e.type}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(e);
  }

  for (const [, group] of byKey) {
    if (group.length < 2) continue;

    // 保留 id 最小的（通常是先建立的种子）
    const sorted = [...group].sort((a, b) => a.id - b.id);
    const keep = sorted[0];

    for (const dup of sorted.slice(1)) {
      merges.push({
        from: dup.id,
        fromName: dup.name,
        to: keep.id,
        toName: keep.name,
        reason: "大小写不同",
      });
    }
  }

  // ---------- 2. 跨类型同名：**不合并** ----------
  //
  // 曾尝试「同名不同类时保留更实体化的类型」（company > model > product），
  // 预演发现该规则会抹掉产品语义：
  //     [product] AWS   → [company] AWS      错，AWS 是云平台不是公司
  //     [product] Sora  → [model] Sora       错，Sora 是视频生成产品
  //     [product] Axios → [company] Axios    错，Axios 是媒体公司
  //
  // 根因是抽取阶段把非产品标成了产品（OpenAI Academy 是项目、Axios 是公司），
  // 属于类型标注问题，不该用「合并」来掩盖 —— 合并会连带丢掉正确的那一条。
  //
  // 改为在关联事件时按名称去重（见 linkEventEntities.ts 的 dedupeByName），
  // 这样既不让界面出现重复标签，也不破坏各实体自身的类型。

  // ---------- 3. 人工映射表 ----------
  const nameIndex = new Map<string, (typeof all)[number]>();
  for (const e of all) nameIndex.set(`${e.name}||${e.type}`, e);

  for (const rule of CANONICAL) {
    const target = nameIndex.get(`${rule.canonical}||${rule.type}`);
    const source = all.find((e) => e.name === rule.alias && e.type === rule.type);

    if (!target || !source) continue;
    if (source.id === target.id) continue;
    if (merges.some((m) => m.from === source.id)) continue;

    merges.push({
      from: source.id,
      fromName: source.name,
      to: target.id,
      toName: target.name,
      reason: "人工映射",
    });
  }

  console.log(`=== 待归并: ${merges.length} 条 ===`);
  console.log("");

  const byReason: Record<string, number> = {};
  for (const m of merges) byReason[m.reason] = (byReason[m.reason] || 0) + 1;
  for (const [r, c] of Object.entries(byReason)) {
    console.log(`  ${r.padEnd(28)} ${c}`);
  }

  console.log("");
  console.log("  === 明细（前 30 条）===");
  for (const m of merges.slice(0, 30)) {
    console.log(`    ${m.fromName}  →  ${m.toName}   (${m.reason})`);
  }
  if (merges.length > 30) console.log(`    ...另有 ${merges.length - 30} 条`);

  if (dryRun) {
    console.log("");
    console.log("  预演模式，未写库");
    await prisma.$disconnect();
    return;
  }

  // ---------- 执行归并 ----------
  let applied = 0;

  for (const m of merges) {
    const from = all.find((e) => e.id === m.from);
    const to = all.find((e) => e.id === m.to);

    if (!from || !to) continue;

    // 把来源的名字与别名并入目标
    const mergedAliases = joinAliases([
      ...pickAliases(to.aliases),
      from.name,
      ...pickAliases(from.aliases),
    ]);

    await prisma.entity.update({
      where: { id: m.to },
      data: { aliases: mergedAliases },
    });

    // 来源标记为 merged 并指向目标（不删除，保留可追溯性）
    await prisma.entity.update({
      where: { id: m.from },
      data: { status: "merged", mergedIntoId: m.to },
    });

    applied++;
  }

  console.log("");
  console.log(`  已归并: ${applied} 条`);

  const remain = await prisma.entity.count({ where: { status: { not: "merged" } } });
  const merged = await prisma.entity.count({ where: { status: "merged" } });
  console.log(`  剩余实体: ${remain}`);
  console.log(`  已标记 merged: ${merged}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
