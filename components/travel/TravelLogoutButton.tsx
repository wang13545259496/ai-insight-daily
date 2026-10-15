"use client";

import { useState } from "react";

/**
 * 退出旅行模块。
 *
 * 只在启用了访问口令时渲染（由服务端判断后决定是否挂载）。
 * 退出动作需要清 Cookie，因此必须走接口而不能只做前端跳转。
 */
export default function TravelLogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;

    setPending(true);

    try {
      await fetch("/api/travel/auth", { method: "DELETE" });
    } catch {
      // 即使请求失败也继续跳转：Cookie 未清掉时用户会落回登录页，
      // 不会出现「以为退出了其实还在登录态」的情况
    }

    window.location.href = "/travel/login";
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition hover:border-gray-600 hover:text-gray-200 disabled:opacity-50"
    >
      {pending ? "退出中…" : "退出"}
    </button>
  );
}
