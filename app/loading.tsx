/**
 * 全局加载态。所有页面在数据未就绪时先渲染这里，
 * 避免出现"点击后长时间无反馈"的空白页。
 */
export default function Loading() {
  return (
    <main className="max-w-7xl mx-auto px-8 py-24">
      <div className="flex items-center gap-3 text-gray-400">
        <span
          className="
          inline-block w-4 h-4 rounded-full
          border-2 border-gray-700 border-t-white
          animate-spin
          "
        />
        <span className="text-sm">正在加载…</span>
      </div>

      <div className="mt-12 space-y-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="
            h-28 rounded-xl
            border border-gray-800
            bg-gray-950
            animate-pulse
            "
          />
        ))}
      </div>
    </main>
  );
}
