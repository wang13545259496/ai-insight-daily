"use client";

import { useState } from "react";

/**
 * 旅行模块的登录表单。
 *
 * 为什么是客户端组件：需要处理输入状态、提交与错误提示。
 * 口令通过 /api/travel/auth 校验，成功后由服务端下发 Cookie，
 * 因此这里不接触任何与口令比较相关的逻辑。
 */

export default function TravelLoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/travel/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        next?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.message || "登录失败，请重试");
        setPending(false);

        return;
      }

      // 用整页跳转而非 router.push：需要在携带新 Cookie 的前提下
      // 重新经过 Proxy 校验，整页导航最直接可靠。
      window.location.href = data.next || "/agent-travel";
    } catch {
      setError("网络异常，请重试");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <label htmlFor="travel-password" className="block text-xs text-gray-400">
        访问口令
      </label>

      <input
        id="travel-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        autoComplete="current-password"
        placeholder="请输入口令"
        className="mt-2 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
      />

      {error && (
        <p className="mt-2 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || password.length === 0}
        className="mt-4 w-full rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
      >
        {pending ? "校验中…" : "进入"}
      </button>

      <p className="mt-3 text-center text-xs text-gray-600">
        口令由站点管理员设置，登录状态保持 30 天。
      </p>
    </form>
  );
}
