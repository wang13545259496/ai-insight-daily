import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "关于本站 · AI Insight Daily",
  description:
    "AI Insight Daily 是什么、内容如何生成、有什么局限，以及内容来源与免责说明。",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-[11px] font-bold tracking-[0.3em] text-gray-500 uppercase">
          ABOUT
        </div>

        <h1 className="mt-3 text-4xl leading-tight font-bold">关于本站</h1>

        <p className="mt-6 text-base leading-8 text-gray-700">
          AI Insight Daily 是一个
          <strong className="text-black">个人独立运营的技术实验项目</strong>，
          用于探索「AI 能否自动理解并组织 AI 产业信息」这件事。
          它不是新闻媒体机构，不提供新闻采编服务，也不对外承接内容业务。
        </p>

        {/* ---------- 内容怎么来的 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">内容是怎么来的</h2>

          <ol className="mt-5 space-y-4 text-base leading-8 text-gray-700">
            <li>
              <span className="font-bold text-black">1. 采集</span>
              <br />
              从公开 RSS 与厂商官方博客获取标题、摘要与链接。不抓取付费墙内容，
              不绕过任何访问限制。
            </li>

            <li>
              <span className="font-bold text-black">2. 摘要改写</span>
              <br />
              正文为<strong className="text-black">摘要与改写</strong>，
              平均长度约 300 字，<strong className="text-black">不转载全文</strong>。
              每条内容标注原始来源，并提供跳转原文的链接。
            </li>

            <li>
              <span className="font-bold text-black">3. AI 分析</span>
              <br />
              由人工智能模型生成核心判断、产业影响、商业机会、投资判断与评分。
              这部分内容
              <strong className="text-black">全部由机器产生，未经人工编辑审核</strong>。
            </li>

            <li>
              <span className="font-bold text-black">4. 实体抽取</span>
              <br />
              从正文中提取公司、模型、产品、人物，并校验「名称必须在原文中逐字出现」，
              以降低模型臆造。
            </li>
          </ol>
        </section>

        {/* ---------- 局限 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">你需要知道的局限</h2>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <ul className="space-y-4 text-base leading-8 text-gray-700">
              <li>
                <strong className="text-black">AI 生成内容可能有错。</strong>
                模型会误读、会过度推断、会遗漏关键前提。所有分析性文字
                都应视为<strong className="text-black">待验证的观点</strong>，
                而不是结论。
              </li>

              <li>
                <strong className="text-black">评分与判断不是投资建议。</strong>
                AI SCORE、产业价值、投资判断等指标是本项目自定义的启发式指标，
                用于横向比较，<strong className="text-black">不代表收益概率，
                不构成任何投资建议</strong>。
              </li>

              <li>
                <strong className="text-black">不保证时效与完整。</strong>
                采集按定时任务执行，可能存在延迟、漏采或重复。
                请以原始来源为准。
              </li>

              <li>
                <strong className="text-black">分类与实体关联可能不准。</strong>
                实体抽取与归并是自动化过程，父子关系与同名实体可能被混淆。
              </li>
            </ul>
          </div>
        </section>

        {/* ---------- 来源与版权 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">来源与版权</h2>

          <p className="mt-5 text-base leading-8 text-gray-700">
            本站内容基于公开信息整理。新闻事实本身不受著作权保护，
            但原始报道的表达受保护。本站因此采用
            <strong className="text-black">摘要改写 + 署名 + 链回原文</strong>
            的方式，不复制原始表达。
          </p>

          <p className="mt-4 text-base leading-8 text-gray-700">
            如果你是本项目的某条内容所涉权利人，认为该内容的使用方式不当，
            请通过下方方式联系，我们会在核实后删除或调整。
          </p>
        </section>

        {/* ---------- 联系方式 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">联系方式</h2>

          <div className="mt-5 rounded-2xl border border-gray-200 p-6">
            <p className="text-base leading-8 text-gray-700">
              内容纠错、权利主张、技术交流，均可用下面的方式联系。
            </p>

            <p className="mt-4 text-base leading-8 text-gray-700">
              <span className="font-bold text-black">邮箱：</span>
              <a
                href="mailto:w13545259496@qq.com"
                className="underline decoration-gray-300 underline-offset-4 hover:decoration-black"
              >
                w13545259496@qq.com
              </a>
            </p>

            <p className="mt-3 text-sm leading-7 text-gray-500">
              邮件通常会在数日内回复。涉及权利主张时，请注明具体页面地址与理由，
              以便快速核实处理。
            </p>
          </div>
        </section>

        {/* ---------- 免责 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">免责声明</h2>

          <div className="mt-5 border-l-4 border-black pl-6">
            <p className="text-base leading-8 text-gray-700">
              本站所有内容按「现状」提供，不对准确性、完整性、时效性作任何明示或
              默示担保。因使用本站内容而产生的任何直接或间接损失，
              本站不承担责任。读者应自行核实信息，并独立作出判断。
            </p>
          </div>
        </section>

        <p className="mt-16 text-sm text-gray-600">
          最后更新：2026 年 10 月 17 日
        </p>
      </div>
    </main>
  );
}
