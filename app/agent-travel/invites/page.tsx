import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import InviteManager from "@/components/agent-travel/InviteManager";
import { OWNER_GRANT, isTravelProtected } from "@/lib/travel-access";
import { currentTravelGrant } from "@/lib/travel-access-server";

/**
 * 邀请码管理页（仅维护者）。
 *
 * /agent-travel/invites
 *
 * ## 为什么在站内做这个页面
 *
 * 原先只能在服务器上跑命令行生成码。维护者常常是临时想给朋友一个码，
 * 手机上没有终端就没法操作。
 *
 * ## 为什么这不算新增攻击面
 *
 * 生成码所需的权限，与查看全部行程完全相同 —— 都是 owner。
 * 好友虽然已登录，但这里会拒绝（不是「有没有登录」，而是「是不是 owner」）。
 * 能进这个页面的人，本来就能看到所有人的数据。
 *
 * ## 两种拒绝方式刻意不同
 *
 *   未登录   → 跳登录页（他可能只是会话过期了）
 *   好友身份 → 404（不告诉他这里有个管理页）
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "邀请码管理 · AI 出行管家",
  // 管理页不该被任何爬虫收录，与企业级的后台一致
  robots: { index: false, follow: false },
};

export default async function TravelInvitesPage() {
  // 未启用口令保护时不存在「维护者」概念，直接放行（本地开发）
  if (!isTravelProtected()) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-sm text-gray-400">当前未启用访问口令，无需邀请码。</p>
      </main>
    );
  }

  const grantId = await currentTravelGrant();

  if (!grantId) {
    redirect("/agent-travel/login?next=/agent-travel/invites");
  }

  // 好友访问按「不存在」处理，不暴露管理页的存在
  if (grantId !== OWNER_GRANT) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
      <nav className="mb-6 flex items-center gap-2 text-xs text-gray-400">
        <Link href="/agent-travel" className="hover:text-sky-400">
          AI 出行管家
        </Link>
        <span>/</span>
        <span className="text-gray-300">邀请码</span>
      </nav>

      <h1 className="text-xl font-bold text-white sm:text-2xl">邀请码管理</h1>

      <p className="mt-2 text-xs leading-relaxed text-gray-400">
        好友用邀请码登录旅行模块，登录后只能看到自己生成的行程，
        每小时最多生成 5 次。码只用一次，兑换后立即失效。
      </p>

      <div className="mt-8">
        <InviteManager />
      </div>
    </main>
  );
}
