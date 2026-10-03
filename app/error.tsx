"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * 全局错误边界（Next.js 16 起恢复回调为 retry）
 * 任何一个页面的渲染异常都会落到这里，避免整站白屏。
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main className="max-w-3xl mx-auto px-8 py-24 text-center">
      <h1 className="text-3xl font-bold mb-4">页面出错了</h1>

      <p className="text-gray-400 mb-2">
        该页面在渲染时发生异常，你可以重试，或返回首页继续浏览。
      </p>

      {error.digest ? (
        <p className="text-gray-600 text-xs mb-8">错误编号：{error.digest}</p>
      ) : (
        <div className="mb-8" />
      )}

      <div className="flex gap-4 justify-center">
        <button
          type="button"
          onClick={() => retry()}
          className="
          px-6 py-2 rounded-lg
          bg-white text-black
          hover:bg-gray-200 transition
          "
        >
          重试
        </button>

        <Link
          href="/"
          className="
          px-6 py-2 rounded-lg
          border border-gray-700 text-gray-300
          hover:border-gray-500 hover:text-white transition
          "
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
