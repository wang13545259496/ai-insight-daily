import { prisma } from "@/lib/prisma";

/** 实体详情页用到的展示型数据结构 */
export interface RelatedEvent {
  id: number;
  title: string;
  titleZh: string | null;
  category: string;
  heatScore: number;
  industryScore: number;
  trendStatus: string;
  isPrimary: boolean;
  newsCount: number;
}

/** 详情页最多展示多少条相关新闻 */
export const RELATED_NEWS_LIMIT = 30;

export interface RelatedNews {
  id: number;
  title: string;
  titleZh: string | null;
  source: string;
  publishedAt: Date | null;
  aiScore: number;
  /** subject（标题中出现）/ background（正文提及）/ event（事件继承，当前默认关闭） */
  role: string;
  mentions: number;
}

export interface CoEntity {
  id: number;
  name: string;
  type: string;
  /** 与该实体共同出现在多少个事件里 */
  shared: number;
}

export interface EntityProfile {
  id: number;
  name: string;
  type: string;
  aliases: string[];
  description: string | null;
  eventCount: number;
  newsCount: number;
  events: RelatedEvent[];
  /** 相关新闻（按发布时间倒序，最多 RELATED_NEWS_LIMIT 条） */
  news: RelatedNews[];
  /** 共同出现最多的其它实体 */
  coEntities: CoEntity[];
  /** 该实体作为主体的事件数 */
  primaryCount: number;
  /** 关联事件覆盖的时间范围 */
  firstEventAt: Date | null;
  lastEventAt: Date | null;
}

/** 从 |a|b| 形式取出别名数组 */
export function parseAliases(aliases: string | null | undefined): string[] {
  return (aliases || "")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/**
 * 组装实体详情页所需的全部数据。
 *
 * 共现（co-occurrence）的计算方式：
 *   取该实体关联的全部事件，再看这些事件里还出现了哪些其它实体，
 *   按共同事件数排序。这能反映「谁和谁总是一起出现」——
 *   例如 Google 与 DeepMind、GPT 与 OpenAI。
 *
 *   之所以不用模型来推断关系，是因为共现次数本身是可验证的事实，
 *   而模型推断的关系无法核对。宁可给确定的信息。
 */
export async function buildEntityProfile(
  entityId: number,
): Promise<EntityProfile | null> {
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, status: { not: "merged" } },
    select: {
      id: true,
      name: true,
      type: true,
      aliases: true,
      description: true,
      eventCount: true,
      newsCount: true,
    },
  });

  if (!entity) return null;

  // 该实体关联的事件（含新闻数，用于显示事件的规模）
  const links = await prisma.eventEntity.findMany({
    where: { entityId },
    select: {
      isPrimary: true,
      event: {
        select: {
          id: true,
          title: true,
          titleZh: true,
          category: true,
          heatScore: true,
          industryScore: true,
          trendStatus: true,
          createdAt: true,
          _count: { select: { news: true } },
        },
      },
    },
  });

  const events: RelatedEvent[] = links
    .map((l) => ({
      id: l.event.id,
      title: l.event.title,
      titleZh: l.event.titleZh,
      category: l.event.category,
      heatScore: l.event.heatScore,
      industryScore: l.event.industryScore,
      trendStatus: l.event.trendStatus,
      isPrimary: l.isPrimary,
      newsCount: l.event._count.news,
    }))
    .sort((a, b) => b.industryScore - a.industryScore);

  const eventIds = links.map((l) => l.event.id);

  /**
   * 相关新闻：**主体优先，组内按时间倒序**。
   *
   * 为什么不能只按时间排：
   *   实测 OpenAI 页面上，最新两条是 InfoQ 的「CloudWatch Omni」
   *   与「Spring 近期新闻」—— 它们确实提到了 OpenAI（标为「提及」正确），
   *   但按时间倒序会把真正以 OpenAI 为主体的文章挤下去。
   *   实体页的用途是「这个主体最近在发生什么」，开头就该是主体新闻。
   *
   * 分两次查询再合并：Prisma 无法按「role 的优先级」排序。
   */
  const newsSelect = {
    role: true,
    mentions: true,
    news: {
      select: {
        id: true,
        title: true,
        titleZh: true,
        source: true,
        publishedAt: true,
        aiScore: true,
      },
    },
  } as const;

  const subjectLinks = await prisma.newsEntity.findMany({
    where: { entityId, role: "subject", news: { dataStatus: "active" } },
    select: newsSelect,
    orderBy: { news: { publishedAt: "desc" } },
    take: RELATED_NEWS_LIMIT,
  });

  // 主体不足时，用「提及」类补齐
  const remaining = RELATED_NEWS_LIMIT - subjectLinks.length;

  const backgroundLinks =
    remaining > 0
      ? await prisma.newsEntity.findMany({
          where: {
            entityId,
            role: { not: "subject" },
            news: { dataStatus: "active" },
          },
          select: newsSelect,
          orderBy: { news: { publishedAt: "desc" } },
          take: remaining,
        })
      : [];

  const news: RelatedNews[] = [...subjectLinks, ...backgroundLinks].map((l) => ({
    id: l.news.id,
    title: l.news.title,
    titleZh: l.news.titleZh,
    source: l.news.source,
    publishedAt: l.news.publishedAt,
    aiScore: l.news.aiScore,
    role: l.role,
    mentions: l.mentions,
  }));

  // 共现实体：这些事件里还出现了谁
  let coEntities: CoEntity[] = [];

  if (eventIds.length > 0) {
    const others = await prisma.eventEntity.findMany({
      where: {
        eventId: { in: eventIds },
        entityId: { not: entityId },
        entity: { status: { not: "merged" } },
      },
      select: {
        entity: { select: { id: true, name: true, type: true } },
      },
    });

    const counter = new Map<number, CoEntity>();

    for (const o of others) {
      const cur = counter.get(o.entity.id);

      if (cur) {
        cur.shared += 1;
      } else {
        counter.set(o.entity.id, {
          id: o.entity.id,
          name: o.entity.name,
          type: o.entity.type,
          shared: 1,
        });
      }
    }

    /**
     * 按共现次数排序。
     *
     * 同次数时优先显示 company —— 读者关心「还涉及哪些公司」
     * 甚于「还涉及哪些模型」，且公司名通常比模型名更易识别。
     */
    const typeRank: Record<string, number> = {
      company: 4,
      model: 3,
      product: 2,
      person: 1,
    };

    coEntities = Array.from(counter.values())
      .sort((a, b) => {
        if (b.shared !== a.shared) return b.shared - a.shared;
        return (typeRank[b.type] ?? 0) - (typeRank[a.type] ?? 0);
      })
      .slice(0, 12);
  }

  const times = links
    .map((l) => l.event.createdAt)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    ...entity,
    aliases: parseAliases(entity.aliases),
    events,
    news,
    coEntities,
    primaryCount: links.filter((l) => l.isPrimary).length,
    firstEventAt: times[0] ?? null,
    lastEventAt: times[times.length - 1] ?? null,
  };
}

/** 实体类型的中文名与排序权重 */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  company: "公司",
  model: "模型",
  product: "产品",
  person: "人物",
};

export const ENTITY_TYPE_ORDER = ["company", "model", "product", "person"];
