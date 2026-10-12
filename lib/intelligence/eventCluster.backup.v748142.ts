import { prisma } from "@/lib/prisma";

function normalizeText(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[，。！？、,.!?：:；;（）()【】[\]"'“”‘’\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  const normalized = normalizeText(text);

  const latin = normalized
    .split(/\s+/)
    .filter((item) => item.length >= 2);

  const chinese = Array.from(normalized)
    .filter((char) => /[\u4e00-\u9fff]/.test(char));

  const bigrams: string[] = [];

  for (let i = 0; i < chinese.length - 1; i++) {
    bigrams.push(chinese[i] + chinese[i + 1]);
  }

  return Array.from(new Set([...latin, ...bigrams]));
}

function similarity(a: string, b: string) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);

  if (!aTokens.length || !bTokens.length) return 0;

  const bSet = new Set(bTokens);
  let same = 0;

  for (const token of aTokens) {
    if (bSet.has(token)) same++;
  }

  return same / Math.max(aTokens.length, bTokens.length);
}

function extractKeywords(title: string) {
  return tokenize(title)
    .slice(0, 12)
    .join(",");
}

export async function buildEventClusters() {
  const news = await prisma.news.findMany({
    where: {
      eventId: null,
      dataStatus: "active",
      publishedAt:{
        gte:new Date(
          Date.now()-30*24*60*60*1000
        )
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 500,
  });

  if (!news.length) {
    return {
      events: 0,
      news: 0,
      linked: 0,
    };
  }

  const events = await prisma.newsEvent.findMany({
    where: {
      status: "active",
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 200,
  });

  let linked = 0;
  let created = 0;

  for (const item of news) {
    let bestEvent: typeof events[number] | null = null;
    let bestScore = 0;

    for (const event of events) {
      const score = Math.max(
        similarity(item.title, event.title),
        similarity(item.title, event.keywords)
      );

      if (score > bestScore) {
        bestScore = score;
        bestEvent = event;
      }
    }

    if (bestEvent && bestScore >= 0.32) {
      await prisma.news.update({
        where: { id: item.id },
        data: {
          eventId: bestEvent.id,
        },
      });

      linked++;
      continue;
    }

    const event = await prisma.newsEvent.create({
      data: {
        title: item.title,
        keywords: extractKeywords(item.title),
        category: item.category,
        summary:
          `围绕“${item.title}”形成的AI产业事件。系统将持续聚合相关来源并跟踪后续发展。`,
        heatScore: 10,
        peakScore: 10,
        trendStatus: "rising",
        trendSummary: "新事件进入监测阶段。",
        eventType: "news",
        qualityScore: Math.min(
          100,
          40 +
            (item.verified ? 20 : 0) +
            Math.min(30, item.sourceCount * 10)
        ),
      },
    });

    await prisma.news.update({
      where: { id: item.id },
      data: {
        eventId: event.id,
      },
    });

    events.push(event);
    created++;
  }

  return {
    events: created,
    news: news.length,
    linked,
  };
}
