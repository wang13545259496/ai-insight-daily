import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";

const prisma = new PrismaClient();

const parser = new Parser();

function normalizeTitle(title: string) {
  return title

    .toLowerCase()

    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")

    .trim();
}

function similarity(a: string, b: string) {
  const long = a.length > b.length ? a : b;

  const short = a.length > b.length ? b : a;

  if (!long.length) {
    return 0;
  }

  let same = 0;

  for (const char of short) {
    if (long.includes(char)) {
      same++;
    }
  }

  return same / long.length;
}

interface QualityCheckItem {
  title?:string;
  link?:string;
  content?:string;
  contentSnippet?:string;
}
// ==============================
// 新闻质量检测 V7.4.8.10.5.5.8.6.7
// ==============================

function checkNewsQuality(item: QualityCheckItem) {
  const errors: string[] = [];

  const title = item.title?.trim() || "";

  const url = item.link?.trim() || "";

  const content = item.content || item.contentSnippet || "";

  // 标题检测

  if (!title) {
    errors.push("标题为空");
  }

  if (title.length < 8) {
    errors.push("标题过短");
  }

  // 原始链接检测

  if (!url) {
    errors.push("缺少原始链接");
  }

  // 内容检测

  if (content.length < 50) {
    errors.push("内容不足");
  }

  return {
    pass: errors.length === 0,

    errors,
  };
}

async function duplicateCheck(
  title: string,

  source: string,

  url: string,
) {
  if (url) {
    const exists = await prisma.news.findFirst({
      where: {
        sourceUrl: url,
      },
    });

    if (exists) {
      return true;
    }
  }

  const normalized = normalizeTitle(title);

  const recent = await prisma.news.findMany({
    where: {
      source,

      createdAt: {
        gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    },

    select: {
      title: true,
    },

    take: 100,
  });

  for (const item of recent) {
    const old = normalizeTitle(item.title);

    if (old === normalized) {
      return true;
    }

    const score = similarity(
      normalized,

      old,
    );

    if (score > 0.85) {
      return true;
    }
  }

  return false;
}

async function collectNews() {
  console.log("启动RSS新闻质量准入采集系统...");

  const sources = await prisma.source.findMany({
    where: {
      enabled: true,

      rssUrl: {
        not: null,
      },
    },
  });

  console.log(`新闻源数量:${sources.length}`);

  for (const source of sources) {
    if (!source.rssUrl) {
      continue;
    }

    console.log(`正在采集:${source.name}`);

    try {
      const feed = await parser.parseURL(source.rssUrl);

      let add = 0;

      let skip = 0;

      let filtered = 0;

      for (const item of feed.items) {
        // ======================
        // 新闻质量检测
        // ======================

        const quality = checkNewsQuality(item);

        if (!quality.pass) {
          filtered++;

          console.log(`过滤:${item.title} 原因:${quality.errors.join(",")}`);

          continue;
        }

        const title = item.title!.trim();

        const url = item.link!.trim();

        const duplicate = await duplicateCheck(
          title,

          source.name,

          url,
        );

        if (duplicate) {
          skip++;

          continue;
        }

        await prisma.news.create({
          data: {
            title,

            category: "AI资讯",

            background: `${source.name}新闻`,

            summary: item.contentSnippet || title,

            content: item.content || item.contentSnippet || title,

            source: source.name,

            sourceUrl: url,

            verified: false,

            sourceCount: 1,
          },
        });

        add++;
      }

      await prisma.source.update({
        where: {
          id: source.id,
        },

        data: {
          lastFetch: new Date(),
        },
      });

      console.log(
        `${source.name}

新增:${add}

重复:${skip}

质量过滤:${filtered}`,
      );
    } catch (error) {
      console.log(
        `${source.name}采集失败`,

        error,
      );
    }
  }

  console.log("RSS新闻质量准入采集完成");
}

collectNews().finally(async () => {
  await prisma.$disconnect();
});
