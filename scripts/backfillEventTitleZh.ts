/**
 * 回填英文事件标题的中文翻译。
 *
 * 背景：
 * 首页「今日重点」的卡片主标题是**事件标题**（NewsEvent.title），
 * 而事件标题由聚类时取首条新闻的标题，因此可能是英文。
 * 实测 31 个事件中 17 个为英文，会直接暴露给首页读者。
 *
 * 与回填新闻标题（backfillTitleZh.ts）的差异：
 *
 *   1. **语境更丰富**。事件有 summary（聚类生成的综述），
 *      还关联多篇新闻。翻译时把 summary 与关联新闻标题一并作为语境，
 *      比只给一个标题准确（事件标题往往很短，单看容易误解）。
 *
 *   2. **数据量小**。事件只有几十个，无需并发池，顺序处理即可。
 *
 *   3. **不处理中文标题**。事件标题是「OpenAI生态」这类中文标签时
 *      原样保留，不做任何改写。
 *
 * 用法：
 *   npx tsx scripts/backfillEventTitleZh.ts --dry-run   只列出，不调用模型
 *   npx tsx scripts/backfillEventTitleZh.ts             处理全部
 *   npx tsx scripts/backfillEventTitleZh.ts --force     重译已有中文标题的事件
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
/**
 * 关闭思考模式。
 *
 * 本脚本要的是按提示词输出固定 JSON 或纯文本，不依赖深度推理。
 * 开着思考时推理会吃掉大量输出预算 —— 旅行模块曾因此拿到空内容
 * 并静默降级到模板（见 AI_TROUBLESHOOTING_GUIDE.md 对应章节）。
 *
 * OpenAI SDK 的类型定义里没有这个字段，但请求会透传给 DeepSeek。
 */
const THINKING_DISABLED = { thinking: { type: "disabled" } } as const;


import OpenAI from "openai";

/** 判断标题是否为英文：中文字符占比低于 10% 即视为英文 */
function isEnglishTitle(title: string): boolean {
  if (!title) return false;

  const cjk = (title.match(/[\u4e00-\u9fa5]/g) || []).length;

  return cjk / title.length < 0.1;
}

const TRANSLATE_PROMPT = `你是中文科技媒体的资深编辑。

任务：把英文的事件标题翻译成准确、通顺的中文标题。

事件标题是对一组相关新闻的概括，可能比单篇新闻标题更宽泛。

规则：
1. 输出 15-35 字的中文标题，符合中文科技媒体习惯。
2. 公司名、产品名、模型名、技术名保留英文原文，不要音译或意译。
   例如 OpenAI、GPT-6、Claude、Gemini、Google DeepMind 保持原样。
3. 不要添加原标题没有的信息，不要把宽泛的事件标题写成具体新闻标题。
4. 不要使用「震惊」「重磅」等夸张词。
5. 只输出标题本身，不要引号、不要「标题：」前缀、不要任何解释。`;

async function translateEventTitle(
  client: OpenAI,
  title: string,
  summary: string,
  newsTitles: string[],
): Promise<string | null> {
  /**
   * 组装语境。
   *
   * 关联新闻标题优先 —— 它们是真实内容，能说明事件在讲什么。
   *
   * summary 只在「不是模板套话」时才用。实测多数事件综述是
   * 「围绕"原标题"形成的AI产业动态」这类模板，只是重复标题，
   * 对翻译没有任何帮助，反而会干扰模型。
   */
  const context: string[] = [];

  const usableNews = newsTitles.filter((t) => t && t.trim().length > 0);

  if (usableNews.length > 0) {
    context.push(
      `该事件下的新闻标题：\n${usableNews
        .slice(0, 5)
        .map((t) => `- ${t}`)
        .join("\n")}`,
    );
  }

  // 判断综述是否为模板：以「围绕」开头且包含标题片段
  const summaryText = (summary || "").trim();
  const looksTemplated =
    summaryText.startsWith("围绕") ||
    (title.length > 6 && summaryText.includes(title.slice(0, 12)));

  if (summaryText.length > 20 && !looksTemplated) {
    context.push(`事件综述：\n${summaryText.slice(0, 300)}`);
  }

  try {
    const response = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: 0.2,
      ...THINKING_DISABLED,
      messages: [
        { role: "system", content: TRANSLATE_PROMPT },
        {
          role: "user",
          content:
            `英文事件标题：\n${title}` +
            (context.length > 0
              ? `\n\n以下信息供理解语境，不要照抄：\n${context.join("\n\n")}`
              : ""),
        },
      ],
    });

    let out = (response.choices?.[0]?.message?.content || "").trim();

    out = out
      .replace(/^["'“”「『]+|["'“”」』]+$/g, "")
      .replace(/^(标题|中文标题)[:：]\s*/, "")
      .trim();

    if (out.length < 4 || out.length > 60) return null;

    // 模型原样返回英文视为失败
    if (isEnglishTitle(out)) return null;

    return out;
  } catch (error) {
    console.error(`  ✗ 翻译失败: ${String(error).slice(0, 100)}`);
    return null;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");

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
  console.log("回填英文事件标题的中文翻译");
  console.log("=".repeat(50));
  console.log("");

  const events = await prisma.newsEvent.findMany({
    where: { status: "active" },
    select: {
      id: true,
      title: true,
      titleZh: true,
      summary: true,
      industryScore: true,
      news: {
        select: { title: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
      },
    },
    orderBy: { industryScore: "desc" },
  });

  const targets = events.filter((e) => {
    if (!isEnglishTitle(e.title)) return false;
    if (!force && e.titleZh && e.titleZh.trim()) return false;
    return true;
  });

  console.log(`  事件总数:        ${events.length}`);
  console.log(`  跳过（中文标题或已有译文）: ${events.length - targets.length}`);
  console.log(`  待处理:          ${targets.length}`);
  console.log("");

  if (targets.length === 0) {
    console.log("  ✓ 没有需要处理的事件");
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    console.log("  --dry-run 模式，列出全部待处理事件：");
    console.log("");

    for (const e of targets) {
      console.log(`  id=${String(e.id).padStart(4)} score=${Math.round(e.industryScore)}`);
      console.log(`     ${e.title.slice(0, 66)}`);
      if (e.summary) console.log(`     综述: ${e.summary.slice(0, 50)}`);
    }

    console.log("");
    console.log(`  预计费用：约 ¥${((targets.length * 400) / 1e6 * 1).toFixed(3)}`);

    await prisma.$disconnect();
    return;
  }

  // ---------- 顺序处理 ----------
  const startedAt = Date.now();
  let done = 0;
  let failed = 0;

  for (const event of targets) {
    const zh = await translateEventTitle(
      client,
      event.title,
      event.summary || "",
      event.news.map((n) => n.title),
    );

    if (zh) {
      try {
        await prisma.newsEvent.update({
          where: { id: event.id },
          data: { titleZh: zh },
        });
        done++;

        console.log("");
        console.log(`  ✓ id=${event.id}`);
        console.log(`      英: ${event.title.slice(0, 60)}`);
        console.log(`      中: ${zh}`);
      } catch (error) {
        failed++;
        console.error(`  ✗ 写库失败 id=${event.id}: ${String(error).slice(0, 80)}`);
      }
    } else {
      failed++;
      console.log(`  ✗ id=${event.id} 翻译失败：${event.title.slice(0, 50)}`);
    }
  }

  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(0);

  console.log("");
  console.log("=".repeat(50));
  console.log("完成");
  console.log("=".repeat(50));
  console.log("");
  console.log(`  成功: ${done}`);
  console.log(`  失败: ${failed}`);
  console.log(`  耗时: ${totalSec}s`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("致命错误:", error);
  process.exit(1);
});
