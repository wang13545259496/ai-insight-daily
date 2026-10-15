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
 * 关键字的选择依据（实测得出的结论）：
 *   · 景点用**多个词**而非单一大类词 —— 单一关键词的召回有天花板，
 *     同类 POI 全在一个词下竞争。实测只用「风景名胜」时杭州返回 20 条、
 *     西湖只占 2 条（主景区 + 断桥残雪），而「苏堤春晓」「三潭印月」
 *     这类真实存在的著名景点都没进候选
 *   · 用「风景名胜」而非泛词「景点」—— 后者会召回教堂、
 *     CBD公园、江堤步道这类弱相关 POI
 *   · 餐厅用「美食」「特色小吃」「本地菜」，实测美食一词 20/20 条
 *     带人均消费，质量好；补两个词是为了覆盖小吃与本地菜馆
 */
const SIGHT_KEYWORDS = ["风景名胜", "博物馆", "公园", "古镇"];
const SIGHT_TYPES = "110000|140000"; // 风景名胜 | 科教文化服务（含博物馆、美术馆）
const RESTAURANT_KEYWORDS = ["美食", "特色小吃", "本地菜"];
const RESTAURANT_TYPES = "050000"; // 餐饮服务

/**
 * 门票价的现实情况：高德 POI **不提供景点门票价格**。
 * 实测杭州 20 条景点全部无 biz_ext.cost，而餐厅 19/20 条有人均价。
 * 因此景点侧只能提供「名称 + 区域 + 评分 + 坐标」，
 * 门票金额仍由模型按常识给出，并由预算的门票科目兜底 ——
 * 这一点在提示词里明确说明，避免模型把「票价未知」误解为零成本。
 */
export const SIGHT_COST_UNAVAILABLE = true;

/**
 * 每类取多少条候选。
 *
 * 从 20 提到 40 的原因：实测 20 条覆盖不了目的地的全部著名景点 ——
 * 杭州行程里模型用到的「苏堤春晓」「浙江省博物馆之江馆」都是真实地点，
 * 但不在 20 条候选内，于是模型只能靠自己的知识补充。
 * 提高上限后这类补充会减少。
 */
export const POI_LIMIT = 40;

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
 * 判断 POI 是否属于旅游相关类型。
 *
 * 为什么需要它：按评分排序会让无关 POI 排到前面 ——
 * 实测杭州结果里「建兰中学」「浙江音乐学院」「某酒店」都是 5.0 分，
 * 把 4.9 分的西湖挤到后面。中小学与高校的评分虚高是普遍现象。
 *
 * 高德的 type 字段形如「科教文化服务;学校;中学」或「风景名胜;公园广场」，
 * 因此按分号分段做白名单匹配。
 */
const TOURISM_TYPE_HINTS = [
  "风景名胜",
  "公园广场",
  "博物馆",
  "美术馆",
  "展览馆",
  "图书馆",
  "科技馆",
  "文化宫",
  "游乐场",
  "动物园",
  "植物园",
  "寺庙道观",
  "教堂",
  "古镇",
  "旅游景点",
  "纪念馆",
  "剧院",
  "体育休闲",
];

function isTourismType(type: string): boolean {
  const t = String(type || "");

  // 学校、酒店、住宅等明确排除
  if (/学校|中学|小学|大学|学院|幼儿园|培训/.test(t)) return false;
  if (/住宿服务|宾馆|酒店|旅馆/.test(t)) return false;
  if (/住宅|商务住宅|写字楼|公司企业/.test(t)) return false;
  if (/餐饮服务/.test(t)) return false;

  return TOURISM_TYPE_HINTS.some((h) => t.includes(h));
}

/**
 * 多关键词 + 双排序检索并合并去重。
 *
 * 为什么需要这种组合：
 *   · 单关键词的召回有天花板 —— 同类 POI 都在一个词下竞争，
 *     实测杭州用「风景名胜」只取到 2 条西湖相关
 *   · 单排序的偏好不同 —— `weight`（综合权重）偏向交通便利的热门点，
 *     `rating`（评分）偏向口碑好的点，实测两者结果差异明显
 *
 * 排序规则：先按「是否旅游相关类型」分层，层内再按评分降序。
 * 这样既能把无关 POI 压到后面，又能在真正的景点之间按口碑排序。
 *
 * 请求数 = 关键词数 × 2，高德的 place/text 免费，可接受。
 */
async function searchPoiMerged(
  keywords: string[],
  city: string,
  types: string,
  limit: number,
): Promise<{ items: PoiItem[]; error: string | null }> {
  const perQuery = Math.min(25, Math.max(1, limit));

  const tasks = keywords.flatMap((kw) => [
    searchPoi(kw, city, types, perQuery, "weight"),
    searchPoi(kw, city, types, perQuery, "rating"),
  ]);

  const results = await Promise.all(tasks);

  // 只要有一个关键词成功就算成功，避免单个词无结果就整块失败
  const anySuccess = results.some((r) => r.error === null);
  const error = anySuccess ? null : (results[0]?.error ?? null);

  const seen = new Set<string>();
  const unique: PoiItem[] = [];

  for (const item of results.flatMap((r) => r.items)) {
    const key = item.id || item.name;

    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(item);
  }

  // 分层排序：旅游相关类型优先，层内按评分降序
  unique.sort((a, b) => {
    const ta = isTourismType(a.type) ? 1 : 0;
    const tb = isTourismType(b.type) ? 1 : 0;

    if (ta !== tb) return tb - ta;

    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  return { items: unique.slice(0, limit), error };
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
    searchPoiMerged(SIGHT_KEYWORDS, city, SIGHT_TYPES, limit),
    searchPoiMerged(RESTAURANT_KEYWORDS, city, RESTAURANT_TYPES, limit),
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
