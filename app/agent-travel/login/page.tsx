import Link from "next/link";

import TravelLoginForm from "@/components/agent-travel/TravelLoginForm";
import { isTravelProtected } from "@/lib/travel-access";

/**
 * 旅行模块登录页。
 * /agent-travel/login?next=/agent-travel/41
 *
 * 由 proxy.ts 在未通过口令校验时重定向到这里。
 * 页面本身必须是公开的，否则会重定向到自己形成死循环 ——
 * proxy.ts 的 isProtectedTravelPage 已把它排除。
 */

export const dynamic = "force-dynamic";

/** 只接受站内相对路径，避免 next 参数被构造成外部跳转 */
function safeNext(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/agent-travel";

  return raw;
}

export default async function TravelLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const protectedMode = isTravelProtected();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-lg border border-gray-800 bg-gray-950/50 p-6">
        <h1 className="text-lg font-bold text-white">AI 出行管家</h1>

        <p className="mt-2 text-xs leading-relaxed text-gray-400">
          {protectedMode
            ? "输入访问口令或好友给你的邀请码，即可查看与生成行程方案。"
            : "当前未设置访问口令，该模块处于公开状态。"}
        </p>

        <div className="mt-6 flex justify-center">
          {protectedMode ? (
            <TravelLoginForm next={next} />
          ) : (
            <Link
              href={next}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
            >
              直接进入
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
