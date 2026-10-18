/**
 * 阶段 2：抽取实体词典。
 *
 * 输入：已分析新闻的标题 + 摘要（分批喂给模型）
 * 输出：Entity 表中的实体记录（status 视来源而定）
 *
 * 设计要点：
 *
 * 1. **只允许从原文抽取**。提示词明确要求实体名必须逐字出现在给定文本里，
 *    抽取后在代码侧再校验一次，防止模型造出不存在的公司。
 *
 * 2. **别名合并**。同一实体的不同写法（OpenAI / Open AI / OpenAI公司）
 *    归并到一条记录，别名用 | 分隔且首尾带分隔符 ——
 *    这样匹配时用「包含 |别名| 」而非子串，避免 Apple 命中 Appleby。
 *
 * 3. **种子实体优先**。先用 Investment（3 家公司）与 IndustryHotspot
 *    的 keywords（25 个模型/产品名）建种子，标为 active；
 *    模型新抽到的标 candidate，便于区分「已知」与「待核」。
 *
 * 4. **分批 + 断点续跑**。每批 30 条；处理的批次号写入进度文件，
 *    中断后重跑会跳过已完成的批次。
 *
 * 5. **不调用模型即可预演**。--dry-run 显示分批情况与种子实体。
 *
 * 用法：
 *   npx tsx scripts/extractEntities.ts --dry-run
 *   npx tsx scripts/extractEntities.ts                 处理全部
 *   npx tsx scripts/extractEntities.ts --days 30       只处理近 30 天
 *   npx tsx scripts/extractEntities.ts --seed-only     只建种子实体
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";

const BATCH_SIZE = 30;
const PROGRESS_FILE = "backup/entity-extract-progress.json";
const SUMMARY_LIMIT = 200;

interface ExtractedEntity {
  name: string;
  type: string;
  aliases: string[];
  description: string;
}

const TYPES = ["company", "model", "product", "person"];

/** 别名规范化为 |a|b| 形式 */
function normalizeAliases(aliases: string[]): string {
  const clean = aliases
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && a.length < 40);

  const uniq = Array.from(new Set(clean));

  return uniq.length === 0 ? "|" : `|${uniq.join("|")}|`;
}

const SYSTEM_PROMPT = `你是 AI 产业情报的实体抽取器。

任务：从给定的新闻列表中抽取「实体」——具体的公司、AI 模型、产品、人物。

严格要求：

1. **只能抽取在文本中逐字出现的实体名**。不得凭常识补充文本里没有的公司或模型。
   若某个名字只出现在你的记忆里而不在给定文本中，不要输出。

2. 实体类型只能是以下四种之一：
   company  —— 公司、机构、实验室（OpenAI、Anthropic、Google DeepMind）
   model    —— AI 模型（GPT-6、Claude、Gemini、Llama、Step 5）
   product  —— 具体产品、服务、工具（ChatGPT、Copilot、Cursor、Cloudflare Workers）
   person   —— 人物（Sam Altman、Dario Amodei）

3. 不要抽取：
   - 泛称：AI、大模型、智能体、算法、开发者、用户、行业
   - 地理与时间：美国、中国、2026年、周一
   - 抽象概念：开源、闭源、安全性、对齐
   - 过于宽泛的技术词：Python、React、SQL（除非作为某公司的具体产品出现）

4. 别名：同一实体的常见变体写法，如 "Open AI" 之于 "OpenAI"。
   只列文本中或业界通用的写法，不要臆造。

5. 描述：一句话说明这个实体是什么（20-40 字），不确定就留空字符串。

6. name 用业界最通用的写法，公司/模型保留英文原名不翻译。

输出严格 JSON，不要 Markdown：
{"entities":[{"name":"...","type":"company","aliases":["..."],"description":"..."}]}

若某篇新闻里没有任何符合要求的实体，跳过它即可，不要凑数。`;

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const seedOnly = argv.includes("--seed-only");
  const daysArg = argv.indexOf("--days");
  const days = daysArg >= 0 ? Number(argv[daysArg + 1]) || null : null;

  // 动态 import：ai-summary 在顶层读环境变量，须等 dotenv 执行完
  const { prisma } = await import("@/lib/prisma");

  console.log("=".repeat(60));
  console.log("阶段 2：抽取实体词典");
  console.log("=".repeat(60));
  console.log("");

  // ---------- 1. 建种子实体 ----------
  const seeds: Array<{ name: string; type: string; aliases: string[]; description: string }> = [];

  const investments = await prisma.investment.findMany({
    select: { name: true, industry: true, description: true },
  });

  for (const inv of investments) {
    if (!inv.name) continue;
    seeds.push({
      name: inv.name,
      type: "company",
      aliases: [],
      description: (inv.description || "").slice(0, 60),
    });
  }

  const hotspots = await prisma.industryHotspot.findMany({
    select: { name: true, keywords: true, category: true },
  });

  /**
   * 已知实体的类型与说明。
   *
   * 热点关键词里会带出具体产品/公司名（过滤掉宽泛词后目前恰好是
   * GPT / Claude / Gemini / NVIDIA 四个）。
   *
   * 原先一律写成 `type: "model"` + `description: ""`，带来两个错误：
   *   · 页面显示「暂无说明」—— 而这几个恰恰是全站关联新闻最多的实体
   *     （GPT 关联 283 篇、Claude 28 篇、Gemini 16 篇）
   *   · NVIDIA 是公司却被标成模型
   *
   * 更麻烦的是：AI 提取遇到已存在实体会因唯一约束跳过，
   * 所以这些空说明不会被后续流程自动补上。
   *
   * 这里给一份准确的中文说明。这几个名字固定、含义明确，
   * 人工写比让模型从新闻里猜可靠。
   */
  const KNOWN_ENTITIES: Record<string, { type: string; description: string }> = {
    GPT: {
      type: "model",
      description: "OpenAI 的生成式预训练模型系列，ChatGPT 的底层模型",
    },
    Claude: {
      type: "model",
      description: "Anthropic 的对话模型系列，以长上下文与安全性见长",
    },
    Gemini: {
      type: "model",
      description: "谷歌的多模态大模型系列，覆盖搜索与云服务场景",
    },
    NVIDIA: {
      type: "company",
      description: "美国 GPU 与 AI 芯片制造商",
    },
  };

  // 热点 keywords 里的是模型/产品名（如 GPT, Claude, Gemini, NVIDIA）
  for (const h of hotspots) {
    const kws = (h.keywords || "").split(",").map((k) => k.trim()).filter(Boolean);
    for (const k of kws) {
      // 过滤掉过于宽泛的词
      if (/^(大模型|LLM|GPU|芯片|算力|机器人|具身智能|SaaS|企业AI|Copilot|自动化|AI员工|智能体|Agent|CUDA|Humanoid)$/i.test(k)) {
        continue;
      }
      const known = KNOWN_ENTITIES[k] ?? KNOWN_ENTITIES[k.toUpperCase()];

      if (!known) {
        // 不认识的词也要播种（可能是新出现的模型名），
        // 但要留下痕迹 —— 否则又会静默产生一批「暂无说明」
        console.warn(
          `[entities] 种子「${k}」没有预置说明，页面会显示「暂无说明」；` +
            `建议补进 KNOWN_ENTITIES`,
        );
      }

      seeds.push({
        name: k,
        type: known?.type ?? "model",
        aliases: [],
        description: known?.description ?? "",
      });
    }
  }

  console.log("=== 1. 种子实体 ===");
  console.log(`  来自 Investment:      ${investments.length} 条`);
  console.log(`  来自 Hotspot keywords: ${seeds.length - investments.length} 条`);
  console.log(`  种子合计:             ${seeds.length} 条`);

  if (dryRun) {
    console.log("");
    for (const s of seeds.slice(0, 12)) {
      console.log(`    ${s.type.padEnd(8)} ${s.name}`);
    }
    if (seeds.length > 12) console.log(`    ...另有 ${seeds.length - 12} 条`);
  }

  // 写入种子（status=active，因为是已知实体）
  if (!dryRun) {
    let created = 0;
    for (const s of seeds) {
      try {
        await prisma.entity.create({
          data: {
            name: s.name,
            type: s.type,
            aliases: normalizeAliases(s.aliases),
            description: s.description || null,
            status: "active",
          },
        });
        created++;
      } catch {
        // 已存在则跳过（唯一约束）
      }
    }
    console.log(`  已写入种子:           ${created} 条（重复的跳过）`);
  }

  if (seedOnly) {
    console.log("");
    console.log("  --seed-only 模式，不再抽取");
    await prisma.$disconnect();
    return;
  }

  // ---------- 2. 取待抽取的新闻 ----------
  const where: Record<string, unknown> = { analysisStatus: "completed" };

  if (days) where.publishedAt = { gt: new Date(Date.now() - days * 86_400_000) };

  const news = await prisma.news.findMany({
    where,
    select: { id: true, title: true, summary: true },
    orderBy: { publishedAt: "desc" },
  });

  const batches: Array<typeof news> = [];
  for (let i = 0; i < news.length; i += BATCH_SIZE) {
    batches.push(news.slice(i, i + BATCH_SIZE));
  }

  console.log("");
  console.log("=== 2. 抽取范围 ===");
  console.log(`  新闻数:   ${news.length}`);
  console.log(`  批次数:   ${batches.length}（每批 ${BATCH_SIZE} 条）`);
  console.log(`  预计费用: 约 ¥${((news.length * 200 / 1.5) / 1e6 + (batches.length * 800 * 2) / 1e6).toFixed(2)}`);

  if (dryRun) {
    console.log("");
    console.log("  预演模式，不再继续");
    await prisma.$disconnect();
    return;
  }

  // ---------- 3. 逐批抽取 ----------
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.error("✗ 未配置 DEEPSEEK_API_KEY");
    process.exit(1);
  }

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    timeout: 60_000,
    maxRetries: 2,
  });

  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });

  let doneBatches: number[] = [];
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      doneBatches = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8")).done ?? [];
    } catch {}
  }

  const startedAt = Date.now();
  let newEntities = 0;
  let mergedAliases = 0;
  let failedBatches = 0;

  // 已有实体名索引（用于避免重复查询）
  const existing = await prisma.entity.findMany({ select: { id: true, name: true, type: true, aliases: true } });
  const index = new Map<string, { id: number; aliases: string }>();
  for (const e of existing) index.set(`${e.name}||${e.type}`, { id: e.id, aliases: e.aliases });

  for (let bi = 0; bi < batches.length; bi++) {
    if (doneBatches.includes(bi)) continue;

    const batch = batches[bi];

    const lines = batch
      .map((n, i) => `${i + 1}. ${n.title}\n   ${(n.summary || "").slice(0, SUMMARY_LIMIT)}`)
      .join("\n");

    let parsed: { entities?: ExtractedEntity[] } | null = null;

    try {
      const res = await client.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `以下是 ${batch.length} 条新闻：\n\n${lines}` },
        ],
      });

      const text = res.choices?.[0]?.message?.content || "";
      parsed = JSON.parse(text);
    } catch (e) {
      failedBatches++;
      console.error(`  ✗ 批次 ${bi + 1} 失败: ${String(e).slice(0, 90)}`);
      continue;
    }

    const list = Array.isArray(parsed?.entities) ? parsed.entities : [];

    // 批内原文（用于「必须逐字出现」的校验）
    const batchText = batch.map((n) => `${n.title} ${n.summary || ""}`).join(" ");

    for (const raw of list) {
      const name = String(raw?.name || "").trim();
      const type = String(raw?.type || "").trim();

      if (!name || name.length > 40) continue;
      if (!TYPES.includes(type)) continue;

      // 校验：实体名必须出现在该批原文里
      if (!batchText.includes(name)) continue;

      const key = `${name}||${type}`;
      const aliases = normalizeAliases(Array.isArray(raw.aliases) ? raw.aliases : []);
      const desc = String(raw.description || "").slice(0, 80);

      const hit = index.get(key);

      if (hit) {
        // 已有：合并新别名
        const merged = mergeAliases(hit.aliases, aliases);

        if (merged !== hit.aliases) {
          await prisma.entity.update({ where: { id: hit.id }, data: { aliases: merged } });
          hit.aliases = merged;
          mergedAliases++;
        }
      } else {
        try {
          const created = await prisma.entity.create({
            data: {
              name,
              type,
              aliases,
              description: desc || null,
              status: "candidate",
            },
          });
          index.set(key, { id: created.id, aliases });
          newEntities++;
        } catch {
          // 并发或重复，忽略
        }
      }
    }

    doneBatches.push(bi);
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ done: doneBatches }, null, 2));

    if ((bi + 1) % 5 === 0 || bi + 1 === batches.length) {
      const el = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
      console.log(
        `  批次 ${bi + 1}/${batches.length}｜新实体 ${newEntities}｜合并别名 ${mergedAliases}｜${el} 分钟`,
      );
    }
  }

  // ---------- 4. 汇总 ----------
  const total = await prisma.entity.count();
  const byType = await prisma.entity.groupBy({ by: ["type"], _count: true });
  const byStatus = await prisma.entity.groupBy({ by: ["status"], _count: true });

  console.log("");
  console.log("=".repeat(60));
  console.log("完成");
  console.log("=".repeat(60));
  console.log("");
  console.log(`  新增实体:     ${newEntities}`);
  console.log(`  合并别名:     ${mergedAliases}`);
  console.log(`  失败批次:     ${failedBatches}`);
  console.log(`  实体总数:     ${total}`);
  console.log("");
  console.log("  按类型:");
  for (const g of byType) console.log(`    ${g.type.padEnd(10)} ${g._count}`);
  console.log("  按状态:");
  for (const g of byStatus) console.log(`    ${g.status.padEnd(10)} ${g._count}`);

  await prisma.$disconnect();
}

/** 合并两组 |a|b| 形式的别名 */
function mergeAliases(a: string, b: string): string {
  const pick = (s: string) => s.split("|").map((x) => x.trim()).filter(Boolean);
  const set = new Set([...pick(a), ...pick(b)]);

  return set.size === 0 ? "|" : `|${Array.from(set).join("|")}|`;
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
