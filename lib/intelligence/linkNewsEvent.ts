import { prisma } from "@/lib/prisma";

function normalize(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[，。！？、,.!?：:；;（）()【】[\]"'“”‘’\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string) {
  const value = normalize(text);

  const words = value
    .split(/\s+/)
    .filter((item) => item.length >= 2);

  const chars = Array.from(value)
    .filter((char) => /[\u4e00-\u9fff]/.test(char));

  const bigrams: string[] = [];

  for (let i = 0; i < chars.length - 1; i++) {
    bigrams.push(chars[i] + chars[i + 1]);
  }

  return Array.from(new Set([...words, ...bigrams]));
}

function matchScore(title: string, eventTitle: string, keywords: string) {
  const source = new Set([
    ...tokens(eventTitle),
    ...tokens(keywords),
  ]);

  const target = tokens(title);

  if (!source.size || !target.length) return 0;

  let matched = 0;

  for (const token of target) {
    if (source.has(token)) matched++;
  }

  return matched / target.length;
}

export async function linkNewsEvents() {
  const newsList = await prisma.news.findMany({
    where: {
      eventId: null,
      dataStatus: "active",
    },
    take: 500,
  });

  const events = await prisma.newsEvent.findMany({
    where: {
      status: "active",
    },
  });

  let linked = 0;

  for (const news of newsList) {
    let bestEvent: typeof events[number] | null = null;
    let bestScore = 0;

    for (const event of events) {
      const score = matchScore(
        news.title,
        event.title,
        event.keywords
      );

      if (score > bestScore) {
        bestScore = score;
        bestEvent = event;
      }
    }

    if (bestEvent && bestScore >= 0.35) {
      await prisma.news.update({
        where: {
          id: news.id,
        },
        data: {
          eventId: bestEvent.id,
        },
      });

      linked++;
    }
  }

  return { linked };
}
