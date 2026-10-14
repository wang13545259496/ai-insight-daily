/**
 * 填充 / 校正新闻源清单。
 *
 * 背景：生产链路此前读 config/sources.ts，其中 6 个源只有 OpenAI 标注为
 * rss，其余 5 个被 `if (source.type !== "rss") continue` 静默跳过，
 * 导致库中 96% 的新闻来自 OpenAI 一个源；而数据库 Source 表里
 * 明明已有配好可用 RSS 的 Google、Microsoft 等源却从未被采集。
 *
 * 源分三类（由 type 字段区分）：
 *   rss      —— 标准 RSS/Atom，直接可用
 *   sitemap  —— 无 RSS 但有 sitemap.xml，按文章 URL 抓取正文
 *   watch    —— 重点监控源（中国大模型核心厂商），保留记录但不自动采集
 *
 * watch 类型的意义：这些厂商（DeepSeek / 豆包 / 通义 / 智谱 / MiniMax /
 * Kimi 等）是中国大模型产业核心，必须收录；但部分站点需 JS 渲染或
 * 无结构化内容清单，暂无法可靠自动抓取。保留 enabled=1、
 * type='watch'，待网页抓取能力补齐后再启用。
 *
 * 幂等：按 name 做 upsert，可重复执行。
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/populateNewsSources.ts          # 预演
 *   npx tsx --env-file=.env.local scripts/populateNewsSources.ts --apply  # 写入
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

type SourceKind = "rss" | "sitemap" | "watch";

interface SourceSpec {
  name: string;
  url: string;
  /** RSS 源填 feed 地址；sitemap 源填 sitemap.xml；watch 源留空 */
  feedUrl: string | null;
  kind: SourceKind;
  rssWeight: number;
  note?: string;
}

/**
 * 源清单。
 *
 * ⚠️ 全部地址均在 2026-10 实测通过。
 */
const SPECS: SourceSpec[] = [
  // ==================== RSS 源 ====================
  {
    name: "OpenAI 官方博客",
    url: "https://openai.com",
    feedUrl: "https://openai.com/news/rss.xml",
    kind: "rss",
    rssWeight: 100,
  },
  {
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/",
    feedUrl: "https://blog.google/technology/ai/rss/",
    kind: "rss",
    rssWeight: 95,
  },
  {
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/",
    feedUrl: "https://deepmind.google/blog/rss.xml",
    kind: "rss",
    rssWeight: 95,
    note: "偶发返回非 XML 内容导致解析失败，已计入 failedSources 不中断流水线",
  },
  {
    name: "Microsoft AI Blog",
    url: "https://news.microsoft.com/source/topics/ai/",
    feedUrl: "https://news.microsoft.com/source/topics/ai/feed/",
    kind: "rss",
    rssWeight: 90,
  },
  {
    name: "arXiv cs.AI",
    url: "https://arxiv.org/list/cs.AI/recent",
    feedUrl: "http://export.arxiv.org/rss/cs.AI",
    kind: "rss",
    rssWeight: 85,
    note: "正文平均 1492 字",
  },
  {
    name: "arXiv cs.CL",
    url: "https://arxiv.org/list/cs.CL/recent",
    feedUrl: "http://export.arxiv.org/rss/cs.CL",
    kind: "rss",
    rssWeight: 85,
    note: "正文平均 1570 字",
  },
  {
    name: "BAIR Blog",
    url: "https://bair.berkeley.edu/blog/",
    feedUrl: "https://bair.berkeley.edu/blog/feed.xml",
    kind: "rss",
    rssWeight: 85,
    note: "正文 10572-48795 字，但更新极慢（最新文章距今 76 天）",
  },
  {
    name: "The Gradient",
    url: "https://thegradient.pub/",
    feedUrl: "https://thegradient.pub/rss/",
    kind: "rss",
    rssWeight: 80,
  },
  {
    name: "Simon Willison",
    url: "https://simonwillison.net/",
    feedUrl: "https://simonwillison.net/atom/everything/",
    kind: "rss",
    rssWeight: 80,
    note: "正文平均 2728 字",
  },
  {
    name: "MIT News AI",
    url: "https://news.mit.edu/topic/artificial-intelligence2",
    feedUrl: "https://news.mit.edu/rss/topic/artificial-intelligence2",
    kind: "rss",
    rssWeight: 80,
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/",
    feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
    kind: "rss",
    rssWeight: 75,
  },
  {
    name: "MIT Technology Review",
    url: "https://www.technologyreview.com/",
    feedUrl: "https://www.technologyreview.com/feed/",
    kind: "rss",
    rssWeight: 75,
  },
  {
    name: "量子位",
    url: "https://www.qbitai.com/",
    feedUrl: "https://www.qbitai.com/feed",
    kind: "rss",
    rssWeight: 75,
    note: "中文源；RSS 只给导语，正文由 articleBody 按链接补全（347-5098 字）",
  },
  {
    name: "InfoQ 中文",
    url: "https://www.infoq.cn/",
    feedUrl: "https://www.infoq.cn/feed",
    kind: "rss",
    rssWeight: 70,
    note: "中文源；content 是链接占位符，正文由 articleBody 补全",
  },
  {
    name: "OSChina 资讯",
    url: "https://www.oschina.net/news",
    feedUrl: "https://www.oschina.net/news/rss",
    kind: "rss",
    rssWeight: 65,
    note: "中文源；正文平均 238 字",
  },

  // 无公开 RSS，已停用
  {
    name: "Anthropic News",
    url: "https://www.anthropic.com/news",
    feedUrl: null,
    kind: "watch",
    rssWeight: 95,
    note: "无公开 RSS（/news/rss.xml 返回 404，加 UA 同样 404）",
  },
  {
    name: "Meta AI",
    url: "https://ai.meta.com/blog/",
    feedUrl: null,
    kind: "watch",
    rssWeight: 95,
    note: "无公开 RSS（/blog/rss/ 返回 400）",
  },
  {
    name: "NVIDIA AI Blog",
    url: "https://blogs.nvidia.com/",
    feedUrl: null,
    kind: "watch",
    rssWeight: 90,
    note: "RSS 存在但本机访问被拒（read ECONNRESET），重试与加 UA 均无效",
  },

  // ==================== sitemap 源 ====================
  // 这四个源实测：文章页正文可抽取 1328-9961 字，且内容是真实新闻
  {
    name: "DeepSeek 官方博客",
    url: "https://www.deepseek.com/news/",
    feedUrl: "https://www.deepseek.com/sitemap.xml",
    kind: "sitemap",
    rssWeight: 100,
    note: "无 RSS；sitemap 含 34 篇文章，正文 1440-1962 字",
  },
  {
    name: "DeepSeek 文档动态",
    url: "https://api-docs.deepseek.com/news/",
    feedUrl: "https://api-docs.deepseek.com/sitemap.xml",
    kind: "sitemap",
    rssWeight: 90,
    note: "无 RSS；sitemap 含 18 篇发布说明，正文 1328 字",
  },
  {
    name: "字节 Seed 博客",
    url: "https://seed.bytedance.com/zh/",
    feedUrl: "https://seed.bytedance.com/sitemap.xml",
    kind: "sitemap",
    rssWeight: 95,
    note: "豆包/Seed 团队官方博客；sitemap 含 12 篇，正文 3793-5594 字",
  },
  {
    name: "通义 Qwen 博客",
    url: "https://qwenlm.github.io/blog/",
    feedUrl: "https://qwenlm.github.io/sitemap.xml",
    kind: "sitemap",
    rssWeight: 95,
    note: "通义千问官方博客；sitemap 含 90 篇，正文 7595-9961 字",
  },

  // ==================== 重点监控源 ====================
  // 中国大模型产业核心厂商：保留记录，待网页抓取能力补齐后启用
  {
    name: "智谱AI",
    url: "https://www.zhipuai.cn/zh/news",
    feedUrl: null,
    kind: "watch",
    rssWeight: 95,
    note: "无 RSS 无文章 sitemap；列表页 /zh/news 可读（3112 字），需爬列表页取文章链接",
  },
  {
    name: "MiniMax",
    url: "https://www.minimax.cn/news",
    feedUrl: null,
    kind: "watch",
    rssWeight: 95,
    note: "无 RSS；/news 列表页需 JS 渲染（仅 440 字），需渲染方案",
  },
  {
    name: "月之暗面Kimi",
    url: "https://www.moonshot.cn/",
    feedUrl: null,
    kind: "watch",
    rssWeight: 95,
    note: "无 RSS 无 sitemap；探测到 kimi.com/blog/ 待验证",
  },
  {
    name: "阿里云通义千问",
    url: "https://tongyi.aliyun.com/",
    feedUrl: null,
    kind: "watch",
    rssWeight: 90,
    note: "产品站无结构化内容；官方博客已由「通义 Qwen 博客」sitemap 源覆盖",
  },
  {
    name: "字节豆包",
    url: "https://www.doubao.com/",
    feedUrl: null,
    kind: "watch",
    rssWeight: 90,
    note: "产品站为 JS 应用（纯文本 19 字）；团队博客已由「字节 Seed 博客」sitemap 源覆盖",
  },
  {
    name: "DeepSeek",
    url: "https://www.deepseek.com/",
    feedUrl: null,
    kind: "watch",
    rssWeight: 90,
    note: "官网首页仅 537 字；新闻页已由「DeepSeek 官方博客」sitemap 源覆盖",
  },
  {
    name: "华为盘古大模型",
    url: "https://www.huaweicloud.com/product/pangu.html",
    feedUrl: null,
    kind: "watch",
    rssWeight: 85,
    note: "华为云 sitemap 有 1518 条但绝大多数是产品文档，需专门筛选",
  },
  {
    name: "阶跃星辰",
    url: "https://www.stepfun.com/",
    feedUrl: null,
    kind: "watch",
    rssWeight: 85,
    note: "无 RSS；sitemap 仅 1 条 URL，暂无可抓内容",
  },
  {
    name: "腾讯混元",
    url: "https://hunyuan.tencent.com/",
    feedUrl: null,
    kind: "watch",
    rssWeight: 85,
    note: "无 RSS",
  },
  {
    name: "腾讯AI",
    url: "https://ai.tencent.com/",
    feedUrl: null,
    kind: "watch",
    rssWeight: 60,
    note: "无 RSS；此前配置裸首页，抓取只得到站点标题",
  },
  {
    name: "百度智能云",
    url: "https://cloud.baidu.com/product/wenxinworkshop",
    feedUrl: null,
    kind: "watch",
    rssWeight: 60,
    note: "无 RSS；此前抓取产物为产品页标题",
  },
  {
    name: "知乎AI话题",
    url: "https://www.zhihu.com/topic/19552832",
    feedUrl: null,
    kind: "watch",
    rssWeight: 50,
    note: "无 RSS",
  },
  {
    name: "微博AI",
    url: "https://weibo.com",
    feedUrl: null,
    kind: "watch",
    rssWeight: 50,
    note: "无 RSS；此前抓取产物为登录页",
  },
];

/** 同源异名，需要停用非规范名的那条 */
const DUPLICATE_NAMES = [{ from: "OpenAI", to: "OpenAI 官方博客", reason: "同源，统一命名" }];

async function main() {
  console.log("========== 新闻源清单校正 ==========");
  console.log(APPLY ? "模式：实际写入" : "模式：预演（加 --apply 才会写库）");
  console.log("");

  const before = await prisma.source.findMany({
    select: {
      id: true,
      name: true,
      rssUrl: true,
      rssEnabled: true,
      enabled: true,
      type: true,
      status: true,
    },
  });

  console.log(`当前 Source 表 ${before.length} 个源。\n`);

  const actions: string[] = [];

  // ---------- 1. 处理同源异名 ----------
  for (const dup of DUPLICATE_NAMES) {
    const record = before.find((item) => item.name === dup.from);

    if (!record) {
      actions.push(`跳过：未找到重复源「${dup.from}」`);
      continue;
    }

    const newsCount = await prisma.news.count({ where: { source: dup.from } });

    if (APPLY) {
      await prisma.source.update({
        where: { id: record.id },
        data: { enabled: false, rssEnabled: false, status: "merged" },
      });
    }

    actions.push(`停用重复源「${dup.from}」（${dup.reason}），其名下 ${newsCount} 条历史数据不动`);
  }

  // ---------- 2. 逐项 upsert ----------
  let created = 0;
  let updated = 0;

  const kindLabel: Record<SourceKind, string> = {
    rss: "RSS 自动源",
    sitemap: "sitemap 自动源",
    watch: "重点监控源",
  };

  for (const spec of SPECS) {
    const existing = before.find((item) => item.name === spec.name);

    // watch 类型保留 enabled=1 但不参与采集（采集器按 type 过滤）
    const data = {
      url: spec.url,
      rssUrl: spec.feedUrl,
      type: spec.kind,
      rssWeight: spec.rssWeight,
      enabled: true,
      rssEnabled: spec.kind !== "watch" && Boolean(spec.feedUrl),
      status: spec.kind === "watch" ? "watch" : "active",
    };

    if (existing) {
      const changed =
        existing.rssUrl !== data.rssUrl ||
        existing.type !== data.type ||
        existing.rssEnabled !== data.rssEnabled ||
        existing.status !== data.status;

      if (changed) {
        if (APPLY) {
          await prisma.source.update({ where: { id: existing.id }, data });
        }

        updated++;

        actions.push(
          `更新「${spec.name}」：${existing.type} → ${data.type}` +
            (existing.rssUrl !== data.rssUrl
              ? `，feed ${existing.rssUrl ?? "(空)"} → ${data.rssUrl ?? "(空)"}`
              : ""),
        );
      }
    } else {
      if (APPLY) {
        await prisma.source.create({ data: { name: spec.name, ...data } });
      }

      created++;

      actions.push(`新增「${spec.name}」[${kindLabel[spec.kind]}]` + (spec.note ? ` — ${spec.note}` : ""));
    }
  }

  console.log("执行明细：");
  for (const line of actions) {
    console.log("  · " + line);
  }

  console.log(`\n新增 ${created} 个、更新 ${updated} 个。`);

  if (!APPLY) {
    console.log("\n以上为预演结果，未做任何修改。确认无误后加 --apply 实际执行。");
  } else {
    const after = await prisma.source.groupBy({
      by: ["type"],
      where: { enabled: true },
      _count: { _all: true },
    });

    console.log("\n写入完成。按类型统计：");
    for (const row of after) {
      const label = kindLabel[row.type as SourceKind] ?? row.type;
      console.log(`  ${label.padEnd(18)} ${row._count._all} 个`);
    }

    const auto = await prisma.source.findMany({
      where: { enabled: true, rssEnabled: true, type: { in: ["rss", "sitemap"] } },
      select: { name: true, type: true, rssUrl: true },
      orderBy: { type: "asc" },
    });

    console.log(`\n参与自动采集的源共 ${auto.length} 个：`);
    for (const s of auto) {
      console.log(`  [${s.type.padEnd(7)}] ${s.name.padEnd(22)} ${s.rssUrl}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("执行失败：", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
