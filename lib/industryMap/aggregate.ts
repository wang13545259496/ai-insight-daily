/**
 * 产业链地图数据聚合：从数据库取出近期新闻，按产业层归类统计。
 *
 * 与 lib/ranking/industryMap.ts 的分工：
 *   industryMap.ts  —— 纯函数，只做分类判定（可单测）
 *   本文件          —— 负责查库、聚合、排序（有副作用）
 *
 * 数据口径（与首页「今日重点」一致）：
 *   - 只看 dataStatus = active 的新闻
 *   - 只看发布时间在近 N 天内的新闻（默认 30 天）
 *   - 排除学术来源与非 AI 内容（见 evaluateForMap）
 */

import { prisma } from "@/lib/prisma";
import {
  INDUSTRY_LAYERS,
  evaluateForMap,
  isCapitalNews,
} from "@/lib/ranking/industryMap";

/** 地图统计的时间窗口（天） */
const MAP_WINDOW_DAYS = 30;

/** 每层展示的代表性新闻条数（首页默认显示 1 条，展开后显示到上限） */
const SAMPLES_PER_LAYER = 12;

/** 每层展示的公司/来源标签数 */
const TAGS_PER_LAYER = 5;

export interface MapLayer {
  /** 层级名 */
  name: string;
  /** 层级说明 */
  description: string;
  /** 该层新闻数 */
  count: number;
  /** 占已归类新闻的比例（0-100，保留一位小数） */
  percent: number;
  /** 代表新闻（按 aiScore 降序，最多 SAMPLES_PER_LAYER 条） */
  samples: Array<{
    id: number;
    title: string;
    source: string;
    aiScore: number;
    publishedAt: number;
  }>;
  /**
   * 该层全部新闻的 id 与标题。
   *
   * 与 samples 的区别：samples 有数量上限（用于展示），
   * all 用于「展开查看全部」——只带 id 与标题，避免传输长列表的完整字段。
   */
  all: Array<{ id: number; title: string }>;
  /** 该层高频出现的来源（作为「谁在这一层活跃」的粗略指标） */
  topSources: string[];
}

export interface CapitalItem {
  id: number;
  title: string;
  source: string;
  layer: string | null;
  publishedAt: number;
}

export interface IndustryMapData {
  /** 各层统计，顺序固定为产业链自上而下 */
  layers: MapLayer[];
  /** 资本动态（融资、并购、估值） */
  capital: CapitalItem[];
  /** 纳入地图的新闻总数 */
  total: number;
  /** 时间窗口天数 */
  windowDays: number;
  /** 数据的时间范围 */
  rangeStart: number;
  rangeEnd: number;
}

/**
 * 构建产业链地图数据。
 *
 * @param windowDays 时间窗口（天），默认 30
 */
export async function buildIndustryMap(
  windowDays = MAP_WINDOW_DAYS,
): Promise<IndustryMapData> {
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  const rows = await prisma.news.findMany({
    where: {
      dataStatus: "active",
      publishedAt: { gte: new Date(since) },
    },
    select: {
      id: true,
      title: true,
      content: true,
      source: true,
      aiScore: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  // ---------- 归类 ----------
  const classified: Array<{
    id: number;
    title: string;
    source: string;
    aiScore: number;
    publishedAt: number;
    layer: string;
    capital: boolean;
  }> = [];

  for (const r of rows) {
    const verdict = evaluateForMap(r.title, r.content || "", r.source);

    if (!verdict.eligible || !verdict.layer) continue;

    classified.push({
      id: r.id,
      title: r.title,
      source: r.source,
      aiScore: Number(r.aiScore) || 0,
      publishedAt: Number(r.publishedAt) || 0,
      layer: verdict.layer,
      capital: isCapitalNews(r.title, r.content || ""),
    });
  }

  const total = classified.length;

  // ---------- 分层聚合 ----------
  const layers: MapLayer[] = INDUSTRY_LAYERS.map((layer) => {
    const matched = classified.filter((c) => c.layer === layer.name);

    // 代表新闻按 aiScore 排序（与首页质量口径一致）
    const samples = [...matched]
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, SAMPLES_PER_LAYER)
      .map((c) => ({
        id: c.id,
        title: c.title,
        source: c.source,
        aiScore: c.aiScore,
        publishedAt: c.publishedAt,
      }));

    // 来源频次
    const sourceCount = new Map<string, number>();

    for (const c of matched) {
      sourceCount.set(c.source, (sourceCount.get(c.source) || 0) + 1);
    }

    const topSources = [...sourceCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TAGS_PER_LAYER)
      .map(([name]) => name);

    return {
      name: layer.name,
      description: layer.description,
      count: matched.length,
      percent: total > 0 ? Math.round((matched.length / total) * 1000) / 10 : 0,
      samples,
      all: matched.map((c) => ({ id: c.id, title: c.title })),
      topSources,
    };
  });

  // ---------- 资本动态 ----------
  const capital: CapitalItem[] = classified
    .filter((c) => c.capital)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      title: c.title,
      source: c.source,
      layer: c.layer,
      publishedAt: c.publishedAt,
    }));

  // ---------- 时间范围 ----------
  const times = classified.map((c) => c.publishedAt).filter((t) => t > 0).sort((a, b) => a - b);

  return {
    layers,
    capital,
    total,
    windowDays,
    rangeStart: times[0] || since,
    rangeEnd: times[times.length - 1] || Date.now(),
  };
}
