/**
 * 景点与餐饮 POI 检索（高德 place/text）。
 *
 * 解决什么问题：逐日行程里的景点与餐厅原本完全由模型凭训练知识写出，
 * 因此会出现三类问题 ——
 *   1. 地点不存在或已停业
 *   2. 门票价格是模型编的，与实际不符
 *   3. 地点没有真实坐标，无法参与通勤计算与布局校验
 *
 * 改为把高德检索到的真实 POI 作为上下文喂给模型，让它从真实候选里挑。
 * 这是本项目「数字与事实用代码取，模型只负责编排」原则的延伸。
 *
 * 接口：GET /v3/place/text（关键字搜索），支持指定城市与类型。
 * 返回字段中的 biz_ext.cost 是人均消费（餐饮）或门票价（景点），
 * 实测并非所有 POI 都有该字段，因此按「有则用、无则忽略」处理。
 */

import { amapGet, isAmapConfigured } from "./amap";
import type { AmapResponse } from "./amap";

/** 一个检索到的地点 */
export interface PoiItem {
  /** 高德 POI id */
  id: string;
  /** 名称 */
  name: string;
  /** 类型（如「风景名胜;公园广场」） */
  type: string;
  /** 地址 */
  address: string;
  /** 坐标 "lng,lat" */
  location: string;
  /** 人均消费或门票价（元）；接口未提供时为 null */
  cost: number | null;
  /** 评分（0-5）；接口未提供时为 null */
  rating: number | null;
  /** 所在区域，如「西湖区」 */
  district: string;
}

/** 按类别检索的结果 */
export interface PoiSearchResult {
  /** 景点（含公园、博物馆、地标） */
  sights: PoiItem[];
  /** 餐厅 */
  restaurants: PoiItem[];
  warnings: string[];
}

/**
 * 检索类别与关键字。
 *
 * 关键字的选择依据：
 *   · 景点用「风景名胜」而非泛词「景点」—— 实测「景点」会召回
 *     教堂、CBD公园、江堤步道这类弱相关的 POI，且只取到 1 条西湖；
 *     「风景名胜」更贴近用户的真实意图
 *   · 餐厅用「美食」，实测召回质量好，19/20 条带人均消费
 */
const SIGHT_KEYWORD = "风景名胜";
const SIGHT_TYPES = "110000"; // 风景名胜
const RESTAURANT_KEYWORD = "美食";
const RESTAURANT_TYPES = "050000"; // 餐饮服务

/**
 * 门票价的现实情况：高德 POI **不提供景点门票价格**。
 * 实测杭州 20 条景点全部无 biz_ext.cost，而餐厅 19/20 条有人均价。
 * 因此景点侧只能提供「名称 + 区域 + 评分 + 坐标」，
 * 门票金额仍由模型按常识给出，并由预算的门票科目兜底 ——
 * 这一点在提示词里明确说明，避免模型把「票价未知」误解为零成本。
 */
export const SIGHT_COST_UNAVAILABLE = true;

/** 每类取多少条候选 */
export const POI_LIMIT = 20;

/** 单次请求超时（毫秒） */
const REQUEST_TIMEOUT_MS = 12_000;

/** 把接口返回的原始 POI 归一化 */
function normalizePoi(raw: Record<string, unknown>): PoiItem | null {
  const name = String(raw.name || "").trim();

  if (!name) return null;

  // 实测 biz_ext 可能是对象，也可能是空数组 []（接口未返回时的形态）
  const bizExt =
    raw.biz_ext && typeof raw.biz_ext === "object" && !Array.isArray(raw.biz_ext)
      ? (raw.biz_ext as Record<string, unknown>)
      : {};

  const costRaw = Number(bizExt.cost);
  const ratingRaw = Number(bizExt.rating);

  return {
    id: String(raw.id || ""),
    name,
    type: String(raw.type || ""),
    address: String(raw.address || ""),
    location: String(raw.location || ""),
    cost: Number.isFinite(costRaw) && costRaw > 0 ? costRaw : null,
    rating: Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : null,
    district: String(raw.adname || ""),
  };
}

/**
 * 按关键字与城市检索 POI。
 *
 * 失败返回空数组并给出告警，不抛异常 ——
 * POI 是增强项，取不到时行程照常生成（只是模型回到凭知识编写）。
 */
async function searchPoi(
  keyword: string,
  city: string,
  types: string,
  limit: number,
  sortrule = "weight",
): Promise<{ items: PoiItem[]; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const payload = await amapGet<
      AmapResponse & { pois?: Array<Record<string, unknown>> }
    >("/v3/place/text", {
      keywords: keyword,
      city,
      citylimit: "true",
      types,
      sortrule,
      offset: String(Math.min(25, Math.max(1, limit))),
      page: "1",
      extensions: "all",
    });

    const pois = Array.isArray(payload.pois) ? payload.pois : [];

    const items = pois
      .map((p) => normalizePoi(p))
      .filter((p): p is PoiItem => p !== null);

    return { items, error: null };
  } catch (e) {
    const msg = String(e);

    return {
      items: [],
      error: msg.includes("abort") ? `${keyword}检索超时` : `${keyword}检索失败：${msg.slice(0, 60)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 按两个排序规则各取一次并合并去重。
 *
 * 为什么取两次：`sortrule=weight`（综合权重）偏向交通便利的热门点，
 * `sortrule=rating`（评分）偏向口碑好的点，两者结果差异明显。
 * 只取一种会漏掉用户真正想去的地方 —— 实测杭州按权重排序时
 * 西湖只出现 1 条，且夹杂教堂、CBD公园等弱相关 POI。
 */
async function searchPoiMerged(
  keyword: string,
  city: string,
  types: string,
  limit: number,
): Promise<{ items: PoiItem[]; error: string | null }> {
  const [byWeight, byRating] = await Promise.all([
    searchPoi(keyword, city, types, limit, "weight"),
    searchPoi(keyword, city, types, limit, "rating"),
  ]);

  const error = byWeight.error ?? byRating.error;

  const seen = new Set<string>();
  const merged: PoiItem[] = [];

  // 评分优先：口碑好的点更值得推荐
  for (const item of [...byRating.items, ...byWeight.items]) {
    const key = item.id || item.name;

    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(item);
  }

  return { items: merged.slice(0, limit), error };
}

/**
 * 检索目的地的景点与餐厅。
 *
 * 两个请求并行；任一失败不影响另一个。
 */
export async function fetchDestinationPois(
  city: string,
  limit = POI_LIMIT,
): Promise<PoiSearchResult> {
  if (!isAmapConfigured()) {
    return { sights: [], restaurants: [], warnings: ["未配置 AMAP_WEB_KEY，无法检索景点与餐厅"] };
  }

  const warnings: string[] = [];

  const [sightResult, restaurantResult] = await Promise.all([
    searchPoiMerged(SIGHT_KEYWORD, city, SIGHT_TYPES, limit),
    searchPoiMerged(RESTAURANT_KEYWORD, city, RESTAURANT_TYPES, limit),
  ]);

  if (sightResult.error) warnings.push(`景点检索失败：${sightResult.error}`);

  if (restaurantResult.error) warnings.push(`餐饮检索失败：${restaurantResult.error}`);

  if (sightResult.items.length === 0 && !sightResult.error) {
    warnings.push(`${city}未检索到景点，模型将依据已有知识编写`);
  }

  return {
    sights: sightResult.items,
    restaurants: restaurantResult.items,
    warnings,
  };
}

/** 把 POI 列表格式化为提示词里的候选清单 */
export function describePoisForPrompt(result: PoiSearchResult): string {
  const lines: string[] = [];

  if (result.sights.length > 0) {
    lines.push("### 可选景点（名称｜区域｜人均/门票｜评分）");

    for (const p of result.sights) {
      const parts = [p.name, p.district || "—"];

      parts.push(p.cost !== null ? `${p.cost} 元` : "票价未知");
      parts.push(p.rating !== null ? `${p.rating} 分` : "无评分");

      lines.push(`- ${parts.join("｜")}`);
    }
  }

  if (result.restaurants.length > 0) {
    lines.push("");
    lines.push("### 可选餐厅（名称｜区域｜人均｜评分）");

    for (const p of result.restaurants) {
      const parts = [p.name, p.district || "—"];

      parts.push(p.cost !== null ? `人均 ${p.cost} 元` : "人均未知");
      parts.push(p.rating !== null ? `${p.rating} 分` : "无评分");

      lines.push(`- ${parts.join("｜")}`);
    }
  }

  return lines.join("\n");
}

/** 统计有门票/人均信息的条目数，用于日志与告警 */
export function countWithCost(items: PoiItem[]): number {
  return items.filter((p) => p.cost !== null).length;
}
