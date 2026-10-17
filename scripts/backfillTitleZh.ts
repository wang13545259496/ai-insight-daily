/**
 * 回填英文新闻的中文标题。
 *
 * 背景：
 * 站内 93% 的新闻标题是英文（OpenAI 官方博客 1267 篇、TechCrunch AI 32 篇等），
 * 而站点主体是中文，列表页中英文混杂。News 表新增 titleZh 字段后，
 * 新采集的新闻会由分析流水线自动生成中文标题，但历史数据需要回填。
 *
 * 设计要点：
 *
 * 1. **只翻译标题，不重新分析**。
 *    重新分析会产生摘要、洞察、评分等全部字段，既浪费额度又会覆盖已有结果。
 *    这里只调用一次模型，输入标题加已有摘要作为语境，输出一个标题。
 *
 * 2. **复用已有的摘要作为上下文**。
 *    实测 1668 篇中 100% 都有 summary，因此不需要重新抓正文。
 *    有语境比只给标题翻译准确得多（尤其是公司名与产品名的处理）。
 *
 * 3. **跳过 arXiv**。
 *    学术论文标题翻译价值低，按约定不处理（120 篇）。
 *
 * 4. **支持断点续跑**。
 *    只处理 titleZh 为空的记录，中断后重跑会自动跳过已完成的。
 *
 * 5. **不覆盖已有翻译**。
 *    除非显式传 --force，否则跳过已有 titleZh 的记录。
 *
 * 用法：
 *   npx tsx scripts/backfillTitleZh.ts --dry-run          只列出待处理，不调用模型
 *   npx tsx scripts/backfillTitleZh.ts --limit 10         试跑 10 条（用于人工检查质量）
 *   npx tsx scripts/backfillTitleZh.ts --days 30          只处理近 30 天
 *   npx tsx scripts/backfillTitleZh.ts                    处理全部
 *   npx tsx scripts/backfillTitleZh.ts --concurrency 3    调整并发（默认 3）
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import OpenAI from "openai";

/** 统计中文字符个数 */
function countCjk(text: string): number {
  return (text.match(/[\u4e00-\u9fa5]/g) || []).length;
}

/**
 * 是否需要翻译。
 *
 * **按中文个数判断，不按占比**。
 *
 * 曾经用「中文字符占比 < 10%」：AI 新闻标题里产品名与模型名密集，
 * 中文占比天然偏低，导致合格的译名被误判为英文而丢弃 ——
 * 实测漏掉 10 条，例如
 *   「OpenAI 推出 GPT-5.4 mini 与 GPT-5.4 nano」= 3 个中文 / 37 字符 = 8%
 *
 * 个数判断只看「有没有中文」，不受产品名长度影响。
 */
function needsTranslation(title: string): boolean {
  if (!title) return false;

  return countCjk(title) < 2;
}

/**
 * 校验翻译结果。
 *
 * 两个条件缺一不可：
 *   · 至少 3 个中文字符 —— 否则说明没有真的翻译
 *   · 与原文不同 —— 防止模型原样返回英文
 */
function isValidTranslation(out: string, original: string): boolean {
  if (countCjk(out) < 3) return false;

  return out.trim().toLowerCase() !== original.trim().toLowerCase();
}

/** 是否为 arXiv 来源（按约定跳过） */
function isArxiv(sourceName: string | null): boolean {
  return /arxiv/i.test(sourceName || "");
}

interface Options {
  dryRun: boolean;
  limit: number | null;
  days: number | null;
  concurrency: number;
  force: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    dryRun: false,
    limit: null,
    days: null,
    concurrency: 3,
    force: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--limit") opts.limit = Number(argv[++i]) || null;
    else if (a === "--days") opts.days = Number(argv[++i]) || null;
    else if (a === "--concurrency") opts.concurrency = Math.max(1, Number(argv[++i]) || 3);
  }

  return opts;
}

const TRANSLATE_PROMPT = `你是中文科技媒体的资深编辑。

任务：把英文新闻标题翻译成准确、通顺的中文标题。

规则：
1. 输出 20-40 字的中文标题，符合中文科技媒体习惯。
2. 公司名、产品名、模型名、技术名保留英文原文，不要音译或意译。
   例如 OpenAI、GPT-6、Claude、Gemini、Llama、Kubernetes、SDK 保持原样。
3. 不要添加原标题没有的信息。
4. 不要使用「震惊」「重磅」「炸裂」等夸张词。
5. 只输出标题本身，不要引号、不要「标题：」前缀、不要任何解释。`;

async function translateTitle(
  client: OpenAI,
  title: string,
  summary: string,
): Promise<string | null> {
  try {
    const response = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: 0.2,
      messages: [
        { role: "system", content: TRANSLATE_PROMPT },
        {
          role: "user",
          content: summary
            ? `英文标题：\n${title}\n\n该新闻的中文摘要（供理解语境，不要照抄）：\n${summary.slice(0, 400)}`
            : `英文标题：\n${title}`,
        },
      ],
    });

    let out = (response.choices?.[0]?.message?.content || "").trim();

    // 模型偶尔会加引号或前缀，清理掉
    out = out.replace(/^["'“”「『]+|["'“”」』]+$/g, "").replace(/^(标题|中文标题)[:：]\s*/, "").trim();

    /**
     * 长度合理性检查。
     *
     * 下限用 4 而非 6：短英文标题的正确译名可能很短 ——
     * 「Consistency Models」的标准译名是「一致性模型」，仅 5 字，
     * 用 6 字下限会把它误判为异常而丢弃（实测发生过）。
     * 噪声风险由下面的「至少 3 个中文」兜住。
     */
    if (out.length < 4 || out.length > 80) return null;

    // 校验：必须有中文，且不能与原文相同
    if (!isValidTranslation(out, title)) return null;

    return out;
  } catch (error) {
    console.error(`  ✗ 翻译失败: ${String(error).slice(0, 100)}`);
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const { prisma } = await import("@/lib/prisma");

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    console.error("✗ 未配置 DEEPSEEK_API_KEY");
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    timeout: 30_000,
    maxRetries: 2,
  });

  console.log("=".repeat(50));
  console.log("回填英文新闻的中文标题");
  console.log("=".repeat(50));
  console.log("");

  // ---------- 查询候选 ----------
  //
  // 注意 News 模型的实际结构（易误判）：
  //   · source 是 String 字段，不是关联表 —— 不能用 source: { select: { name } }
  //   · publishedAt 是 DateTime?，要用 Date 对象比较，不是 BigInt
  //   · 没有 updatedAt 字段，排序只能用 publishedAt 或 createdAt
  const where: Record<string, unknown> = {};

  if (!opts.force) {
    where.OR = [{ titleZh: null }, { titleZh: "" }];
  }

  if (opts.days) {
    const cutoff = new Date(Date.now() - opts.days * 86_400_000);
    where.publishedAt = { gt: cutoff };
  }

  const candidates = await prisma.news.findMany({
    where,
    select: {
      id: true,
      title: true,
      summary: true,
      background: true,
      publishedAt: true,
      source: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  // 在应用层过滤：需要翻译的标题、非 arXiv
  const targets = candidates.filter(
    (n) => needsTranslation(n.title) && !isArxiv(n.source),
  );

  const skippedChinese = candidates.length - targets.length;

  console.log(`  候选记录:        ${candidates.length}`);
  console.log(`  跳过（中文标题或 arXiv）: ${skippedChinese}`);
  console.log(`  待处理:          ${targets.length}`);

  if (opts.limit) {
    console.log(`  本次限制:        ${opts.limit} 条（--limit）`);
  }

  console.log("");

  const queue = opts.limit ? targets.slice(0, opts.limit) : targets;

  if (queue.length === 0) {
    console.log("  ✓ 没有需要处理的记录");
    await prisma.$disconnect();
    return;
  }

  // ---------- 预演模式 ----------
  if (opts.dryRun) {
    console.log("  --dry-run 模式，只列出前 15 条，不调用模型：");
    console.log("");

    queue.slice(0, 15).forEach((n, i) => {
      const d = n.publishedAt
        ? new Date(n.publishedAt).toISOString().slice(0, 10)
        : "无日期";
      console.log(`  ${String(i + 1).padStart(3)}. [${d}] [${n.source || "无来源"}]`);
      console.log(`       ${n.title.slice(0, 70)}`);
    });

    if (queue.length > 15) {
      console.log(`  ...另有 ${queue.length - 15} 条`);
    }

    console.log("");
    console.log(`  预计费用：约 ¥${((queue.length * 310) / 1e6 * 1 + (queue.length * 80) / 1e6 * 2).toFixed(2)}`);

    await prisma.$disconnect();
    return;
  }

  // ---------- 开始处理 ----------
  const startedAt = Date.now();
  let done = 0;
  let failed = 0;

  // 简单的并发池：维持 concurrency 个任务在跑
  let cursor = 0;

  async function worker(workerId: number) {
    while (true) {
      const index = cursor++;

      if (index >= queue.length) return;

      const news = queue[index];

      const zh = await translateTitle(
        client,
        news.title,
        news.summary || news.background || "",
      );

      if (zh) {
        try {
          await prisma.news.update({
            where: { id: news.id },
            data: { titleZh: zh },
          });
          done++;

          if (done % 10 === 0 || done === queue.length) {
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
            console.log(`  进度 ${done}/${queue.length}（失败 ${failed}）｜已用 ${elapsed}s`);
          }
        } catch (error) {
          failed++;
          console.error(`  ✗ 写库失败 id=${news.id}: ${String(error).slice(0, 80)}`);
        }
      } else {
        failed++;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(opts.concurrency, queue.length) },
    (_, i) => worker(i + 1),
  );

  await Promise.all(workers);

  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(0);

  console.log("");
  console.log("=".repeat(50));
  console.log("完成");
  console.log("=".repeat(50));
  console.log("");
  console.log(`  成功: ${done}`);
  console.log(`  失败: ${failed}`);
  console.log(`  耗时: ${totalSec}s`);

  // 抽样展示结果
  //
  // 按 id 倒序而非 updatedAt —— News 模型没有 updatedAt 字段。
  // 用 id 倒序近似「最近改动」，对本脚本足够。
  if (done > 0) {
    const samples = await prisma.news.findMany({
      where: { titleZh: { not: null } },
      select: { title: true, titleZh: true },
      orderBy: { id: "desc" },
      take: 5,
    });

    console.log("");
    console.log("  最近翻译的样例：");

    for (const s of samples) {
      console.log("");
      console.log(`    英: ${s.title.slice(0, 64)}`);
      console.log(`    中: ${(s.titleZh || "").slice(0, 64)}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("致命错误:", error);
  process.exit(1);
});
