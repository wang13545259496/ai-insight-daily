import type { ReactNode } from "react";

/**
 * AI 生成内容标识。
 *
 * ## 依据
 *
 * 《人工智能生成合成内容标识办法》（国信办通字〔2025〕2 号，
 * 2025-09-01 施行）第四条：
 *
 *   「在文本的起始、末尾或者中间适当位置添加文字提示或者通用符号提示
 *     等标识，**或者在交互场景界面、文字周边添加显著的提示标识**」
 *
 * 本站采用后者：在 AI 生成内容的周边放置可见标识。
 *
 * ## 哪些内容要标
 *
 * 只有真正经过模型处理的内容才标，否则就是虚假声明：
 *
 *   ✅ News.summary      AI 摘要
 *   ✅ News.titleZh      AI 翻译标题
 *   ✅ News.category     AI 分类
 *   ✅ 详情页的分析区块   核心判断 / 为什么重要 / 风险
 *
 *   ❌ NewsEvent.summary  模板字符串拼的，不是 AI 生成
 *   ❌ 原始抓取内容       未经处理，详情页会标「原始抓取内容，未经整理」
 *
 * ## 为什么要分两个组件
 *
 * 列表页空间紧张，只放一个小徽标；详情页需要完整披露，
 * 用一整块说明。两者都要，但场合不同。
 */

/** 小徽标：用于列表、摘要旁。 */
export function AiGeneratedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm bg-black px-1.5 py-0.5 text-[11px] leading-none font-bold tracking-wide text-white sm:text-[9px] ${className}`}
      title="本内容由人工智能模型生成"
    >
      AI 生成
    </span>
  );
}

/** 完整披露块：用于详情页 AI 分析内容之前。 */
export function AiDisclosure({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-300 bg-gray-50 px-5 py-4">
      <p className="text-sm leading-7 text-gray-600">
        <AiGeneratedBadge />
        <span className="ml-2 font-bold text-gray-900">
          以下内容由人工智能模型生成，未经人工编辑审核。
        </span>
        可能存在错误或偏差，仅供参考，
        <span className="text-gray-900">不构成投资建议</span>。
        事实信息请以正文与原始来源为准。
        {children}
      </p>
    </div>
  );
}
