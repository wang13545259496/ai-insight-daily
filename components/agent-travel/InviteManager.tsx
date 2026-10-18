"use client";

import { useCallback, useEffect, useState } from "react";

import { INVITE_GENERATION_LIMIT } from "@/lib/travel-invite";

/**
 * 邀请码管理面板。
 *
 * ## 为什么是客户端组件
 *
 * 需要：生成后立刻把明文码显示出来、复制到剪贴板、撤销后刷新列表。
 * 这些都需要状态。服务端只负责首屏与权限判断。
 *
 * ## 明文码只出现一次
 *
 * 数据库存的是哈希，生成接口是唯一返回明文的地方。
 * 所以生成成功后要把码放大显示、并提供一键复制 ——
 * 用户刷新页面就再也拿不回来了，只能重新生成。
 *
 * ## 移动优先
 *
 * 维护者可能随时在手机上生成一个码发给朋友，
 * 所以布局从窄屏设计起，宽屏只是加列。
 */

interface Invite {
  id: number;
  note: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedIp: string | null;
}

interface Generated {
  code: string;
  expiresAt: string;
  days: number;
  note: string;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 状态判断：已使用 > 已过期 > 可用 */
function statusOf(inv: Invite): "used" | "expired" | "available" {
  if (inv.usedAt) return "used";

  return new Date(inv.expiresAt).getTime() <= Date.now() ? "expired" : "available";
}

const STATUS_TEXT: Record<string, { label: string; className: string }> = {
  available: { label: "可用", className: "bg-emerald-500/15 text-emerald-300" },
  used: { label: "已使用", className: "bg-sky-500/15 text-sky-300" },
  expired: { label: "已过期", className: "bg-gray-700/60 text-gray-400" },
};

/** 复制到剪贴板，失败时退回 execCommand（旧浏览器与 http 环境） */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);

      return ok;
    } catch {
      return false;
    }
  }
}

export default function InviteManager() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [days, setDays] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/travel/invites", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: Invite[];
        message?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.message || "读取失败");

        return;
      }

      setInvites(data.data ?? []);
      setError(null);
    } catch {
      setError("网络异常，读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate(event: React.FormEvent) {
    event.preventDefault();

    if (pending) return;

    const trimmed = note.trim();

    if (!trimmed) {
      setError("请填写备注，用来记住这个码给谁了");

      return;
    }

    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/travel/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed, days }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        code?: string;
        expiresAt?: string;
        days?: number;
        note?: string;
        message?: string;
      };

      if (!res.ok || !data.success || !data.code) {
        setError(data.message || "生成失败");
        setPending(false);

        return;
      }

      setGenerated({
        code: data.code,
        expiresAt: data.expiresAt!,
        days: data.days ?? days,
        note: data.note ?? trimmed,
      });

      setNote("");
      await load();
    } catch {
      setError("网络异常，生成失败");
    } finally {
      setPending(false);
    }
  }

  async function revoke(inv: Invite) {
    if (!confirm(`撤销「${inv.note || "未命名"}」的邀请码？撤销后该码无法再使用。`)) {
      return;
    }

    try {
      /**
       * 撤销需要码的明文来定位记录（库里只有哈希）。
       * 但列表接口不返回明文 —— 所以这里改用 id。
       * 见文件末尾的说明。
       */
      const res = await fetch(`/api/travel/invites?id=${inv.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.message || "撤销失败");

        return;
      }

      await load();
    } catch {
      setError("网络异常，撤销失败");
    }
  }

  async function copy(code: string, kind: "code" | "share", shareText?: string) {
    const ok = await copyText(kind === "code" ? code : shareText || code);

    setCopied(ok ? kind : "failed");

    setTimeout(() => setCopied(null), 2000);
  }

  /**
   * 分享文案。
   *
   * 只讲收码人需要知道的两件事：去哪输、能用几次。
   * 有效期在生成页上标着，不写进分享文字 —— 多一句就多一分被忽略的可能。
   *
   * 次数从 INVITE_GENERATION_LIMIT 取而不是写死，
   * 避免「文案说 10 次、实际 5 次」这种漂移。
   */
  const shareText = generated
    ? `AI 出行管家邀请码：${generated.code}\n打开 https://aibiliai.com/agent-travel/login 输入邀请码，每个邀请码最多生成${INVITE_GENERATION_LIMIT}次。`
    : "";

  return (
    <div className="space-y-8">
      {/* ---------- 生成表单 ---------- */}
      <section className="rounded-lg border border-gray-800 bg-gray-950/50 p-5">
        <h2 className="text-sm font-bold text-white">生成邀请码</h2>

        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          给朋友一个码，他就能用旅行模块。码只能用一次，用掉即失效。
        </p>

        <form onSubmit={generate} className="mt-4 space-y-3">
          <div>
            <label htmlFor="invite-note" className="block text-xs text-gray-400">
              备注（给谁用）
            </label>

            <input
              id="invite-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={40}
              placeholder="例如：张三"
              className="mt-1.5 w-full rounded border border-gray-700 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
            />
          </div>

          <div>
            <label htmlFor="invite-days" className="block text-xs text-gray-400">
              未使用时的有效期
            </label>

            <select
              id="invite-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="mt-1.5 w-full rounded border border-gray-700 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
            >
              <option value={1}>1 天</option>
              <option value={3}>3 天</option>
              <option value={7}>7 天</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-400"
          >
            {pending ? "生成中…" : "生成邀请码"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* ---------- 刚生成的码 ---------- */}
      {generated && (
        <section className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-emerald-300">已生成</h2>
              <p className="mt-1 text-xs text-gray-400">
                只显示这一次，刷新后无法再查看。请现在复制。
              </p>
            </div>

            <button
              type="button"
              onClick={() => setGenerated(null)}
              className="shrink-0 text-xs text-gray-500 hover:text-gray-300"
            >
              关闭
            </button>
          </div>

          <div className="mt-4 select-all rounded border border-emerald-700/50 bg-black px-3 py-4 text-center font-mono text-2xl font-bold tracking-widest text-emerald-300">
            {generated.code}
          </div>

          <p className="mt-2 text-center text-xs text-gray-400">
            给「{generated.note}」· {generated.days} 天内有效
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => copy(generated.code, "code")}
              className="rounded border border-gray-700 px-3 py-2 text-xs font-medium text-white transition hover:border-gray-500"
            >
              {copied === "code" ? "已复制 ✓" : "复制邀请码"}
            </button>

            <button
              type="button"
              onClick={() => copy(generated.code, "share", shareText)}
              className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-500"
            >
              {copied === "share" ? "已复制 ✓" : "复制分享文字"}
            </button>
          </div>

          {copied === "failed" && (
            <p className="mt-2 text-xs text-rose-400">
              复制失败，请长按上面的码手动复制。
            </p>
          )}
        </section>
      )}

      {/* ---------- 列表 ---------- */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">历史记录</h2>

          <button
            type="button"
            onClick={() => void load()}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            刷新
          </button>
        </div>

        {loading ? (
          <p className="mt-3 text-xs text-gray-500">读取中…</p>
        ) : invites.length === 0 ? (
          <p className="mt-3 rounded border border-gray-800 bg-gray-950/40 p-4 text-xs text-gray-400">
            还没有生成过邀请码。
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invites.map((inv) => {
              const st = statusOf(inv);
              const meta = STATUS_TEXT[st];

              return (
                <li
                  key={inv.id}
                  className="rounded border border-gray-800 bg-gray-950/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {inv.note || "未命名"}
                        </span>

                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-1 text-[11px] leading-relaxed text-gray-500">
                        {st === "used" ? (
                          <>
                            兑换于 {fmt(inv.usedAt!)}
                            {inv.usedIp ? ` · 来自 ${inv.usedIp}` : ""}
                          </>
                        ) : st === "available" ? (
                          <>过期时间 {fmt(inv.expiresAt)}</>
                        ) : (
                          <>已于 {fmt(inv.expiresAt)} 过期</>
                        )}
                      </div>
                    </div>

                    {st === "available" && (
                      <button
                        type="button"
                        onClick={() => void revoke(inv)}
                        className="shrink-0 rounded border border-rose-800 px-2 py-1 text-[11px] text-rose-300 transition hover:bg-rose-950/50"
                      >
                        撤销
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
