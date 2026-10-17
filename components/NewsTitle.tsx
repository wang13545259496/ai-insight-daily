/**
 * 新闻标题显示。
 *
 * 为什么做成组件而不是在各页面里直接写：
 * 站内显示新闻标题的地方有 10 多处（新闻列表、详情、事件页、日报、
 * 首页推荐等）。若各自写判断逻辑，很容易出现「这里显示中文、
 * 那里显示英文」的不一致，而且后续调整样式要改很多遍。
 *
 * 显示规则：
 *   · 有中文标题时 —— 中文为主，英文原文以小字附在下方
 *   · 无中文标题时 —— 只显示原标题
 *
 * 英文原文为什么保留：
 *   · 读者可对照原文核对翻译准确性
 *   · 公司名与产品名在中文标题里保留英文，看原文更清楚上下文
 * 但它只是辅助信息，因此用小字、弱化颜色，不抢视觉重心。
 *
 * 这是服务端组件（无 "use client"）：纯展示、无状态、无事件，
 * 可在服务端与客户端组件中通用。
 */

interface NewsTitleProps {
  /** 原标题（可能是英文） */
  title: string;
  /** 中文标题，可能为空 */
  titleZh?: string | null;
  /** 中文标题的额外样式（默认继承容器字号与粗细） */
  className?: string;
  /** 英文原文的额外样式 */
  subClassName?: string;
  /**
   * 是否显示英文原文。
   * 列表页等空间紧张处可传 false 只显示中文。
   */
  showOriginal?: boolean;
}

export default function NewsTitle({
  title,
  titleZh,
  className = "",
  subClassName = "",
  showOriginal = true,
}: NewsTitleProps) {
  const zh = (titleZh || "").trim();
  const en = (title || "").trim();

  // 没有中文标题，或中文标题与原文相同（中文来源的情况），只显示一个
  const hasDistinctZh = zh.length > 0 && zh !== en;

  if (!hasDistinctZh) {
    return <span className={className}>{en || zh}</span>;
  }

  return (
    <span className="block">
      <span className={className}>{zh}</span>

      {showOriginal && en.length > 0 && (
        <span
          className={
            // 小一号、降透明度、不换行截断 —— 英文只是辅助，不占视觉重心。
            // 用 block 让它独占一行，避免与中文标题挤在同一行。
            //
            // 用 opacity-70 而非固定的 text-gray-500：
            // 本组件在浅色页与深色页都会用到，固定颜色总有一边不达标
            // （gray-500 在黑底仅 4.34:1）。继承父级颜色再降透明度，
            // 黑底白字与白底黑字分别得到 9.90:1 与 8.45:1，两边都达 AAA。
            "mt-1 block text-[11px] font-normal leading-4 opacity-70 " + subClassName
          }
          // 原文是英文时标注语言，便于浏览器与读屏软件正确处理
          lang={/[\u4e00-\u9fa5]/.test(en) ? undefined : "en"}
        >
          {en}
        </span>
      )}
    </span>
  );
}
