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
  /**
   * 单个输入框，既可能是口令（维护者）也可能是邀请码（好友）。
   * 由服务端按格式判断，用户不用关心自己是哪种身份。
   */
  const [credential, setCredential] = useState("");
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
        body: JSON.stringify({ credential, next }),
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
      <label htmlFor="travel-credential" className="block text-xs text-gray-400">
        访问口令 / 邀请码
      </label>

      <input
        id="travel-credential"
        type="text"
        value={credential}
        onChange={(e) => setCredential(e.target.value)}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder="口令，或 TRV-XXXX-XXXX"
        className="mt-2 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
      />

      {error && (
        <p className="mt-2 text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || credential.trim().length === 0}
        className="mt-4 w-full rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-400"
      >
        {pending ? "校验中…" : "进入"}
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed text-gray-400">
        邀请码只能使用一次，登录状态保持 1 天。
        <br />
        口令登录保持 30 天。
      </p>
    </form>
  );
}
