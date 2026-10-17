import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-gray-800 bg-black px-6 py-10 text-gray-500">
      <div className="mx-auto max-w-7xl">
        {/* 合规声明放在最前 —— 这是本站最需要说清楚的一件事 */}
        <div className="rounded-xl border border-gray-800 bg-zinc-950 p-5">
          <p className="text-sm leading-7 text-gray-400">
            <span className="font-bold text-white">AI 生成内容说明：</span>
            本站的新闻摘要、核心判断、产业影响、商业机会、投资判断及评分等内容，
            均由人工智能模型基于公开信息生成，并经自动化流程处理，
            <span className="text-gray-300">可能存在错误、偏差或滞后</span>。
            这些内容仅供参考与研究，不构成任何投资建议、商业决策依据或事实性结论。
          </p>

          <p className="mt-3 text-sm leading-7 text-gray-400">
            <span className="font-bold text-white">信息来源：</span>
            本站新闻来自公开 RSS 与官方网站，正文为
            <span className="text-gray-300">摘要改写而非全文转载</span>，
            每条内容均标注原始来源并提供原文链接。
            如权利人认为内容不当，可通过下方联系方式要求处理。
          </p>
        </div>

        {/* 链接 */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <Link href="/about" className="transition hover:text-white">
            关于本站
          </Link>
          <Link href="/privacy" className="transition hover:text-white">
            隐私说明
          </Link>
          <Link href="/news" className="transition hover:text-white">
            AI资讯
          </Link>
          <Link href="/entities" className="transition hover:text-white">
            实体库
          </Link>
        </div>

        {/* 版权 */}
        <div className="mt-8 border-t border-gray-800 pt-6">
          <p className="text-sm">© {year} AI Insight Daily</p>

          <p className="mt-2 text-xs leading-6 text-gray-600">
            AI资讯 · AI研究 · AI商业生态平台
            <br />
            本站为个人独立运营的技术与内容实验项目，非新闻媒体机构，
            不提供新闻采编服务。
          </p>
        </div>
      </div>
    </footer>
  );
}
