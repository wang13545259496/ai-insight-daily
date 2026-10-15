/**
 * 行程摘要提取。
 *
 * 解决什么问题：历史方案卡片的摘要用 CSS 的 line-clamp-2 截断，
 * 中文没有词边界，裁切点落在句中时读起来像「话说一半又从头开始」。
 * 实测一个 229 字的 overview 被压进两行后，用户以为文本重复了。
 *
 * 改为在服务端先取出语义完整的第一句，再交给卡片展示。
 *
 * 为什么不能简单按第一个「。」切：中文行文里引号、书名号内也会出现
 * 句号，且有些开篇是「围绕『A+B』双主题展开，节奏松紧结合：」
 * 这类以冒号收尾的引导句，直接切会得到半截话。
 * 因此用长度下限过滤：过短的候选句继续往后并，直到得到完整的表述。
 */

/** 句子结束符 */
const SENTENCE_END = /[。！？]/;

/**
 * 取第一句作为摘要。
 *
 * @param text 原文（overview）
 * @param minLength 摘要最短长度；短于此长度时继续并上下一句
 * @returns 摘要；原文本身很短时原样返回
 */
export function firstSentence(text: string, minLength = 20): string {
  const raw = String(text || "").trim();

  if (!raw) return "";

  // 原文本身不长，无需处理
  if (raw.length <= minLength) return raw;

  // 逐个结束符扫描，累加到满足长度下限为止
  let cursor = 0;

  while (cursor < raw.length) {
    const rest = raw.slice(cursor);
    const match = rest.match(SENTENCE_END);

    if (!match || match.index === undefined) {
      // 没有结束符了，返回剩余全部
      return raw;
    }

    const end = cursor + match.index + 1;
    const candidate = raw.slice(0, end);

    // 候选句达成长度下限即采用
    if (candidate.length >= minLength) {
      return candidate;
    }

    cursor = end;
  }

  return raw;
}

/**
 * 取摘要，超长时按字符截断并加省略号。
 *
 * 用于卡片这类固定展示空间：即便第一句很长，也不会撑破布局。
 */
export function summaryOf(text: string, maxLength = 60, minLength = 20): string {
  const sentence = firstSentence(text, minLength);

  if (sentence.length <= maxLength) return sentence;

  return sentence.slice(0, maxLength).trimEnd() + "…";
}
