import Link from "next/link";

/**
 * 全站页脚。
 *
 * 配色经过实测，全部达到 WCAG AAA（普通文本 ≥7:1，背景 #000000）：
 *   text-gray-200  16.96:1
 *   text-gray-300  14.25:1
 *   text-gray-400   8.27:1
 *
 * 初版用了 text-gray-500（4.34:1，未达 AA）与 text-gray-600（2.78:1，明显不达标），
 * 维护者反馈「对比度太低」，故整体提亮。
 *
 * 第二版是单列四段垂直堆叠（合规卡片 → 链接行 → 联系卡片 → 版权），
 * 桌面端高度约 630px。维护者反馈「最下面这块空间占用太大」。
 *
 * 本版改为大屏两栏：左侧合规声明（占 8/12），右侧链接、联系、版权（占 4/12）。
 * max-w-7xl 有 1280px 宽，单列布局浪费了横向空间；两栏后高度约 240px。
 * 窄屏仍为单列堆叠，但间距与内边距都比原来紧。
 *
 * 内容一个字都没删 —— 合规声明、信息来源、联系方式、主体性质都保留，
 * 只是重排了版式。
 */
export default function Footer() {
  const year = new Date().getFullYear();
  const email = "w13545259496@qq.com";

  return (
    <footer className="mt-16 border-t border-gray-700 bg-black px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">
          {/* 左：合规声明 */}
          <div className="lg:col-span-8">
            <div className="rounded-xl border border-gray-700 bg-zinc-900 px-5 py-4">
              <p className="text-sm leading-6 text-gray-200">
                <span className="font-bold text-white">AI 生成内容说明：</span>
                本站的新闻摘要、核心判断、产业影响、商业机会、投资判断及评分等内容，
                均由人工智能模型基于公开信息生成并经自动化流程处理，
                <span className="font-medium text-white">可能存在错误、偏差或滞后</span>
                ，仅供参考与研究，不构成任何投资建议、商业决策依据或事实性结论。
              </p>

              <p className="mt-2.5 text-sm leading-6 text-gray-200">
                <span className="font-bold text-white">信息来源：</span>
                新闻来自公开 RSS 与官方网站，正文为
                <span className="font-medium text-white">摘要改写而非全文转载</span>
                ，均标注原始来源并链回原文。如权利人认为使用方式不当，
                可邮件要求处理，我们会在核实后删除或调整。
              </p>
            </div>
          </div>

          {/* 右：链接 / 联系 / 版权 */}
          <div className="lg:col-span-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Link
                href="/about"
                className="text-gray-200 underline decoration-gray-500 underline-offset-4 transition hover:text-white hover:decoration-white"
              >
                关于本站
              </Link>
              <Link
                href="/privacy"
                className="text-gray-200 underline decoration-gray-500 underline-offset-4 transition hover:text-white hover:decoration-white"
              >
                隐私说明
              </Link>
              <Link href="/news" className="text-gray-300 transition hover:text-white">
                AI资讯
              </Link>
              <Link href="/entities" className="text-gray-300 transition hover:text-white">
                实体库
              </Link>
            </div>

            <p className="mt-3 text-sm leading-6 text-gray-300">
              联系：
              <a
                href={`mailto:${email}`}
                className="text-gray-200 underline decoration-gray-500 underline-offset-4 transition hover:text-white hover:decoration-white"
              >
                {email}
              </a>
            </p>

            <div className="mt-3 border-t border-gray-700 pt-3">
              <p className="text-sm font-medium text-gray-200">© {year} AI Insight Daily</p>

              <p className="mt-1 text-xs leading-5 text-gray-300">
                AI资讯 · AI研究 · AI商业生态平台
                <br />
                个人独立运营的技术与内容实验项目，非新闻媒体机构，不提供新闻采编服务。
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
