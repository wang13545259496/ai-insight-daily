import Link from "next/link";
import { Suspense } from "react";

import type { Metadata } from "next";

import TripPlannerForm from "@/components/travel/TripPlannerForm";

import { isRollingGoConfigured } from "@/lib/agents/travel/rollinggo";
import { isVariflightConfigured } from "@/lib/agents/travel/variflight";
import { summaryOf } from "@/lib/agents/travel/summary";
import { isTravelProtected } from "@/lib/travel-access";
import TravelLogoutButton from "@/components/travel/TravelLogoutButton";
import { isAmapConfigured } from "@/lib/agents/travel/amap";
import { supportedCityCount } from "@/lib/agents/travel/cities";
import { listPlans } from "@/lib/agents/travel/data";
import { getTravelAIModel, isTravelAIEnabled } from "@/lib/agents/travel/ai";

export const metadata: Metadata = {
  title: "旅行规划",
  description:
    "输入出发地、目的地、去返程日期、人数与预算，自动生成含交通、住宿、餐饮与逐日行程的完整旅行方案。",
};

/** 依赖数据库与外部接口，不做静态化 */
export const dynamic = "force-dynamic";

/** 档位中文名，用于历史列表 */
const STYLE_LABELS: Record<string, string> = {
  budget: "经济型",
  comfort: "舒适型",
  premium: "品质型",
  luxury: "奢享型",
};

/** 报价来源徽标文案 */
function quoteModeLabel(mode: string): { text: string; className: string } {
  if (mode === "live") {
    return { text: "实时报价", className: "bg-emerald-500/15 text-emerald-400" };
  }

  if (mode === "partial") {
    return { text: "部分实时", className: "bg-sky-500/15 text-sky-400" };
  }

  return { text: "估算", className: "bg-gray-500/15 text-gray-400" };
}

/**
 * 运行状态提示条。
 * 如实告知用户当前报价与模型是否真的接通，避免把估算值当成实时价格。
 */
function StatusBanner() {
  const variflightReady = isVariflightConfigured();
  const rollingGoReady = isRollingGoConfigured();
  const aiReady = isTravelAIEnabled();
  const mapReady = isAmapConfigured();

  /** 两类报价各自的实时能力 */
  const flightLive = variflightReady;
  const hotelLive = rollingGoReady;
  const anyLive = flightLive || hotelLive;

  /** 组成一条条状态 */
  const items: Array<{ label: string; ok: boolean; note: string }> = [
    {
      label: "机票报价",
      ok: flightLive,
      note: variflightReady
        ? "飞常准实时票价：覆盖国内全部航司与舱位，取当日最低价"
        : "未配置 VARIFLIGHT_API_KEY，当前按航线距离估算",
    },
    {
      label: "住宿报价",
      ok: hotelLive,
      note: rollingGoReady
        ? "RollingGo 实时报价：库存直连，结果可直接预订"
        : "未配置 ROLLINGGO_API_KEY，当前按目的地档位估算",
    },
    {
      label: "行程编排模型",
      ok: aiReady,
      note: aiReady
        ? `已接入 ${getTravelAIModel()}，负责逐日行程内容编排`
        : "未配置 DEEPSEEK_API_KEY，行程内容将由内置模板生成",
    },
    {
      label: "地图与天气",
      ok: mapReady,
      note: mapReady
        ? "已接入高德：补齐景点坐标、真实通勤时间与逐日天气（仅中国境内）"
        : "未配置 AMAP_WEB_KEY，行程不含坐标、通勤与天气",
    },
  ];

  const hasWarning = items.some((item) => !item.ok);

  return (
    <div
      className={`rounded-lg border p-4 ${
        hasWarning ? "border-amber-500/25 bg-amber-500/5" : "border-emerald-500/25 bg-emerald-500/5"
      }`}
    >
      <h2 className="text-sm font-medium text-white">运行状态</h2>

      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex flex-wrap items-baseline gap-2 text-xs">
            <span className={item.ok ? "text-emerald-400" : "text-amber-400"}>
              {item.ok ? "●" : "○"}
            </span>
            <span className="text-gray-300">{item.label}</span>
            <span className="text-gray-500">{item.note}</span>
          </li>
        ))}
      </ul>

      {!anyLive && (
        <p className="mt-3 border-t border-white/5 pt-3 text-xs text-gray-500">
          在{" "}
          <code className="rounded bg-black/40 px-1 py-0.5 text-gray-400">.env.local</code> 中填入{" "}
          <code className="rounded bg-black/40 px-1 py-0.5 text-gray-400">VARIFLIGHT_API_KEY</code>
          （机票，申请：ai.variflight.com）与{" "}
          <code className="rounded bg-black/40 px-1 py-0.5 text-gray-400">ROLLINGGO_API_KEY</code>
          （酒店，申请：travelportal-partner-center.dida.com）后重启服务，即自动切换为实时报价。
        </p>
      )}
    </div>
  );
}

/** 历史方案列表 */
async function HistoryList() {
  let plans: Awaited<ReturnType<typeof listPlans>> = [];

  try {
    plans = await listPlans(8);
  } catch (error) {
    console.error("[travel] 历史方案读取失败", { error: String(error) });

    return (
      <p className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-xs text-gray-500">
        历史方案暂时无法读取。
      </p>
    );
  }

  if (plans.length === 0) {
    return (
      <p className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-xs text-gray-500">
        还没有生成过方案。填写上方表单后，生成的方案会自动保存在这里，并生成可分享的链接。
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {plans.map((plan) => {
        const badge = quoteModeLabel(plan.quoteMode);

        return (
          <Link
            key={plan.id}
            href={`/travel/${plan.id}`}
            className="group rounded-lg border border-gray-800 bg-gray-950/40 p-4 transition hover:border-sky-500/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-white group-hover:text-sky-300">
                {plan.origin} → {plan.destination}
              </span>
              <span className={`rounded px-2 py-0.5 text-[11px] ${badge.className}`}>
                {badge.text}
              </span>
            </div>

            <p className="mt-1 text-xs text-gray-500">
              {plan.departDate} 至 {plan.returnDate} · {plan.days} 天 · 成人 {plan.adults}
              {plan.children > 0 ? ` / 儿童 ${plan.children}` : ""} · 预算 {plan.budget} 元 ·{" "}
              {STYLE_LABELS[plan.style] ?? plan.style}
            </p>

            {/*
              摘要在服务端取完整首句（summaryOf），不再靠 line-clamp 硬裁。
              中文没有词边界，按行裁切会落在句中，读起来像文本重复。
              仍保留 line-clamp-2 作为兜底：首句本身极长时不会撑破卡片。
            */}
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-400">
              {summaryOf(plan.overview)}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

export default function TravelPage() {
  // 只在启用口令保护时显示退出按钮：未启用时没有"登录态"可退
  const protectedMode = isTravelProtected();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">旅行规划</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
            输入出发地、目的地、去返程日期、同行人数与总预算，自动生成一份完整方案：往返交通、住宿、
            餐饮与门票的预算分配，以及逐日可执行的行程安排。金额由确定性算法计算，行程内容由
            AI 编排，并标注每一笔价格的来源。
          </p>
        </div>

        {protectedMode && <TravelLogoutButton />}
      </header>

      <div className="mt-8 space-y-8">
        <StatusBanner />

        <TripPlannerForm />

        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">历史方案</h2>
            <span className="text-xs text-gray-500">
              已收录 {supportedCityCount()} 个常用城市，其它城市可直接填机场三字码
            </span>
          </div>

          {/* HistoryList 是异步组件，用 Suspense 包住让表单先渲染出来 */}
          <Suspense
            fallback={
              <p className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-xs text-gray-500">
                正在读取历史方案…
              </p>
            }
          >
            <HistoryList />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
