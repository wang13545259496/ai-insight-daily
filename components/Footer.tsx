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
 */
export default function Footer() {
  const year = new Date().getFullYear();
  const email = "w13545259496@qq.com";

  return (
    <footer className="mt-20 border-t border-gray-700 bg-black px-6 py-12">
      <div className="mx-auto max-w-7xl">
        {/* 合规声明放最前 —— 这是本站最需要说清楚的一件事 */}
        <div className="rounded-xl border border-gray-700 bg-zinc-900 p-6">
          <p className="text-sm leading-7 text-gray-200">
            <span className="font-bold text-white">AI 生成内容说明：</span>
            本站的新闻摘要、核心判断、产业影响、商业机会、投资判断及评分等内容，
            均由人工智能模型基于公开信息生成，并经自动化流程处理，
            <span className="font-medium text-white">可能存在错误、偏差或滞后</span>
            。这些内容仅供参考与研究，不构成任何投资建议、商业决策依据或事实性结论。
          </p>

          <p className="mt-4 text-sm leading-7 text-gray-200">
            <span className="font-bold text-white">信息来源：</span>
            本站新闻来自公开 RSS 与官方网站，正文为
            <span className="font-medium text-white">摘要改写而非全文转载</span>
            ，每条内容均标注原始来源并提供原文链接。
            如权利人认为内容使用方式不当，可通下方联系方式要求处理，
            我们会在核实后删除或调整。
          </p>
        </div>

        {/* 链接 */}
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm">
          <Link
            href="/about"
            className="text-gray-200 underline decoration-gray-600 underline-offset-4 transition hover:text-white hover:decoration-white"
          >
            关于本站
          </Link>
          <Link
            href="/privacy"
            className="text-gray-200 underline decoration-gray-600 underline-offset-4 transition hover:text-white hover:decoration-white"
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

        {/* 联系 */}
        <div className="mt-8 rounded-xl border border-gray-700 p-5">
          <p className="text-sm leading-7 text-gray-200">
            <span className="font-bold text-white">联系方式：</span>
            内容纠错、权利主张、技术交流，均可发邮件至{" "}
            <a
              href={`mailto:${email}`}
              className="font-medium text-white underline decoration-gray-500 underline-offset-4 transition hover:decoration-white"
            >
              {email}
            </a>
          </p>
        </div>

        {/* 版权 */}
        <div className="mt-8 border-t border-gray-700 pt-6">
          <p className="text-sm font-medium text-gray-200">© {year} AI Insight Daily</p>

          <p className="mt-2 text-sm leading-7 text-gray-300">
            AI资讯 · AI研究 · AI商业生态平台
            <br />
            本站为个人独立运营的技术与内容实验项目，非新闻媒体机构，不提供新闻采编服务。
          </p>
        </div>
      </div>
    </footer>
  );
}
