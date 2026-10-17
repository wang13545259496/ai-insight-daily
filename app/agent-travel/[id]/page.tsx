import Link from "next/link";
import { notFound } from "next/navigation";

import type { Metadata } from "next";

import PlanView from "@/components/agent-travel/PlanView";
import { getPlanById } from "@/lib/agents/travel/data";

/** 依赖数据库，按请求渲染 */
export const dynamic = "force-dynamic";

/** 解析路径中的方案编号 */
function parseId(raw: string): number | null {
  const numeric = Number(raw);

  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseId(id);

  if (numericId === null) {
    return { title: "方案不存在" };
  }

  const plan = await getPlanById(numericId);

  if (!plan) {
    return { title: "方案不存在" };
  }

  const title = `${plan.query.origin} → ${plan.query.destination} ${plan.duration.days} 天行程方案`;

  return {
    title,
    description: plan.overview.slice(0, 150),
    openGraph: { title, description: plan.overview.slice(0, 150), type: "article" },
  };
}

export default async function TravelPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = parseId(id);

  if (numericId === null) {
    notFound();
  }

  const plan = await getPlanById(numericId);

  if (!plan) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <nav className="mb-6 flex items-center gap-2 text-xs text-gray-400">
        <Link href="/agent-travel" className="hover:text-sky-400">
          AI 出行管家
        </Link>
        <span>/</span>
        <span className="text-gray-400">方案 #{numericId}</span>
      </nav>

      <PlanView plan={plan} planId={numericId} />

      <div className="mt-10 flex flex-wrap gap-3 border-t border-gray-800 pt-6">
        <Link
          href="/agent-travel"
          className="rounded-lg border border-gray-800 px-4 py-2 text-sm text-gray-300 transition hover:border-sky-500/40 hover:text-white"
        >
          再规划一份
        </Link>
      </div>
    </main>
  );
}
