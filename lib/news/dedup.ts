import crypto from "crypto";

/**
 * 新闻去重与来源归并的公共工具。
 *
 * 为什么要独立成模块：项目里此前有 4 份重复实现
 * （newsDuplicate / deduplicate / smartDuplicate / verification/duplicate），
 * 各自算法与阈值都不同，且都只被一次性脚本调用，生产链路实际用的是
 * 简易精确匹配。多套实现并存导致「同一篇文章入库两次」而无人察觉。
 *
 * 这里统一为一份，生产链路与脚本共用。
 */

/**
 * 标题归一化：用于生成去重哈希与相似度比较。
 *
 * 去掉所有空白与标点，仅保留中文、字母、数字，并转小写。
 *
 * 为什么要这么激进：实测发现两条重复记录的标题
 * 「Teaching AI to Speak the Language of Pathology 」与
 * 「Teaching AI to Speak the Language of Pathology」
 * 只差一个尾部空格，精确匹配完全失效。
 * 归一化后二者哈希相同，可直接命中。
 */
export function normalizeTitle(title: string): string {
  return String(title || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, "");
}

/**
 * 生成去重哈希（md5）。
 *
 * 写入 News.duplicateHash 字段，该字段带 @unique 约束。
 * 注意：SQLite 的唯一索引允许多个 NULL，因此「不写哈希」等于
 * 「绕过去重闸门」——这正是此前 44 条记录重复入库的原因。
 * 所有入库路径都必须写这个字段。
 */
export function createTitleHash(title: string): string {
  return crypto.createHash("md5").update(normalizeTitle(title)).digest("hex");
}

/**
 * 计算两个标题的相似度（0-1），基于「字符二元组集合」的 Jaccard 系数。
 *
 * 为什么不用编辑距离：中文标题里改一个数字或版本号
 * （GPT-5 → GPT-5.5）编辑距离很近，但它们是不同新闻。
 * 二元组集合对这类局部改动更不敏感，误判更少。
 *
 * 注意：这个方法仅用于「疑似重复」的提示与人工复核，
 * 不用于自动合并。实测在本项目语料上，前 10 字匹配的
 * 假阳性率高达 31%，自动合并会造成大量错误。
 */
export function titleSimilarity(a: string, b: string): number {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);

  if (!x || !y) return 0;
  if (x === y) return 1;

  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();

    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.slice(i, i + 2));
    }

    // 单字标题退化为单字集合
    if (set.size === 0) set.add(s);

    return set;
  };

  const setA = bigrams(x);
  const setB = bigrams(y);

  let inter = 0;

  for (const item of setA) {
    if (setB.has(item)) inter++;
  }

  const union = setA.size + setB.size - inter;

  return union === 0 ? 0 : inter / union;
}

/** 多来源标签的分隔符，全库统一用中文顿号 */
export const MERGED_SOURCE_SEPARATOR = "、";

/**
 * 归并多来源标签。
 *
 * 输入是已有标签与新增来源名，输出去重后按加入顺序拼接的字符串。
 * 此前实现直接用 `new Set([existing.source, item.source])` 拼接，
 * 在没有任何内容比对的情况下就宣称「多来源」，
 * 造成库中 1078 条（82%）虚假的多源融合标注。
 * 调用方必须确保传入的确实是同一篇文章的来源。
 */
export function mergeSourceLabel(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string {
  const list: string[] = [];

  for (const raw of [existing, incoming]) {
    const value = String(raw || "").trim();

    if (!value) continue;

    for (const part of value.split(MERGED_SOURCE_SEPARATOR)) {
      const name = part.trim();

      if (name && !list.includes(name)) {
        list.push(name);
      }
    }
  }

  return list.join(MERGED_SOURCE_SEPARATOR);
}

/** 拆分多来源标签为数组 */
export function splitSourceLabel(label: string | null | undefined): string[] {
  const value = String(label || "").trim();

  if (!value) return [];

  return value
    .split(MERGED_SOURCE_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}
