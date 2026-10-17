import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私说明 · AI Insight Daily",
  description: "本站收集什么数据、不收集什么数据、如何使用与保存。",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-[11px] font-bold tracking-[0.3em] text-gray-500 uppercase">
          PRIVACY
        </div>

        <h1 className="mt-3 text-4xl leading-tight font-bold">隐私说明</h1>

        <p className="mt-6 text-base leading-8 text-gray-700">
          本站是一个内容阅读站点，
          <strong className="text-black">不需要注册，不要求登录</strong>
          （出行规划模块除外，它使用独立的访问口令）。
          下面说明本站实际收集了哪些数据。
        </p>

        {/* ---------- 收集什么 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">本站收集的数据</h2>

          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 font-bold">数据</th>
                  <th className="px-5 py-3 font-bold">用途</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-5 py-3 font-mono text-xs">页面路径</td>
                  <td className="px-5 py-3 text-gray-700">统计哪些内容被阅读</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-mono text-xs">来源页面</td>
                  <td className="px-5 py-3 text-gray-700">了解访客从何而来</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-mono text-xs">设备类型</td>
                  <td className="px-5 py-3 text-gray-700">
                    区分桌面 / 移动端，用于排版适配
                  </td>
                </tr>
                <tr>
                  <td className="px-5 py-3 font-mono text-xs">访问时间</td>
                  <td className="px-5 py-3 text-gray-700">统计访问趋势</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- 不收集什么 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">本站不收集的数据</h2>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <ul className="space-y-3 text-base leading-8 text-gray-700">
              <li>
                <strong className="text-black">不记录 IP 地址</strong>
                —— 访问统计表中没有该字段
              </li>
              <li>
                <strong className="text-black">不使用 Cookie 追踪</strong>
                —— 除出行模块的登录状态外，不写入任何追踪 Cookie
              </li>
              <li>
                <strong className="text-black">不收集姓名、手机号、邮箱等身份信息</strong>
                —— 本站没有注册功能
              </li>
              <li>
                <strong className="text-black">不嵌入第三方广告或追踪脚本</strong>
                —— 页面不加载任何广告联盟代码
              </li>
              <li>
                <strong className="text-black">不进行用户画像或跨站追踪</strong>
              </li>
            </ul>
          </div>
        </section>

        {/* ---------- 数据如何保存 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">数据如何保存</h2>

          <p className="mt-5 text-base leading-8 text-gray-700">
            访问统计数据保存在本站自有的数据库中，
            <strong className="text-black">不与任何第三方共享、不出售、不转让</strong>。
            由于不含任何个人标识，这些数据无法关联到具体某个人。
          </p>

          <p className="mt-4 text-base leading-8 text-gray-700">
            数据库会定时备份到私有代码仓库的独立分支，
            备份内容与主库相同，同样不含个人标识。
          </p>
        </section>

        {/* ---------- 第三方 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">会接触到请求的第三方</h2>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-gray-200 p-5">
              <p className="font-bold">Cloudflare</p>
              <p className="mt-2 text-sm leading-7 text-gray-700">
                本站通过 Cloudflare 提供访问与安全防护，因此你的请求会经过
                Cloudflare 的网络。Cloudflare 可能按其自身政策记录连接信息，
                这部分不受本站控制。
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 p-5">
              <p className="font-bold">原始来源站点</p>
              <p className="mt-2 text-sm leading-7 text-gray-700">
                点击「查看原始来源」会离开本站，跳转到对应新闻的原始页面。
                该页面上的数据收集行为由该站点决定。
              </p>
            </div>
          </div>
        </section>

        {/* ---------- 出行模块 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">关于出行规划模块</h2>

          <p className="mt-5 text-base leading-8 text-gray-700">
            本站包含一个独立的出行规划工具。使用它需要输入访问口令，
            口令仅用于校验访问权限，
            <strong className="text-black">不会与你的身份关联</strong>。
            你输入的行程信息（出发地、目的地、偏好等）会保存在本站数据库中，
            用于生成与展示方案。
          </p>
        </section>

        {/* ---------- 你的权利 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">你的权利</h2>

          <p className="mt-5 text-base leading-8 text-gray-700">
            由于本站不收集可识别个人身份的信息，通常无法定位「你的数据」。
            如果你仍有疑问，或希望删除某条包含你信息的行程记录，
            可通过{" "}
            <a
              href="/about"
              className="underline decoration-gray-300 underline-offset-4 hover:decoration-black"
            >
              关于本站
            </a>{" "}
            页面的联系方式提出。
          </p>
        </section>

        {/* ---------- 变更 ---------- */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold">本说明的变更</h2>

          <p className="mt-5 text-base leading-8 text-gray-700">
            若本站的数据处理方式发生变化，会更新本页面并修改下方日期。
          </p>
        </section>

        <p className="mt-16 text-sm text-gray-600">
          最后更新：2026 年 10 月 17 日
        </p>
      </div>
    </main>
  );
}
