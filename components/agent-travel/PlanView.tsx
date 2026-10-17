/**
 * 旅行方案展示组件（服务端组件）。
 *
 * 被两处复用：/agent-travel 生成结果区、/agent-travel/[id] 分享页。
 * 纯展示，不含交互状态，因此不需要 "use client"。
 */

import Link from "next/link";

import { formatDuration } from "@/lib/agents/travel/providers";
import { VEHICLE_DEFAULTS } from "@/lib/agents/travel/amap";
import { buildDayMapUrlSafe, MAP_HEIGHT, MAP_WIDTH } from "@/lib/agents/travel/staticmap";
import type {
  BudgetCategory,
  ItineraryActivity,
  TravelPlan,
  TravelStyle,
} from "@/lib/agents/travel/types";

/** 预算档位中文名 */
const STYLE_LABELS: Record<TravelStyle, string> = {
  budget: "经济型",
  comfort: "舒适型",
  premium: "品质型",
  luxury: "奢享型",
};

/** 活动类型对应的图标与颜色 */
const KIND_META: Record<ItineraryActivity["kind"], { icon: string; label: string; color: string }> =
  {
    sight: { icon: "◆", label: "景点", color: "text-sky-400" },
    meal: { icon: "◆", label: "餐饮", color: "text-amber-400" },
    transport: { icon: "◆", label: "交通", color: "text-violet-400" },
    experience: { icon: "◆", label: "体验", color: "text-emerald-400" },
    rest: { icon: "◆", label: "休息", color: "text-gray-400" },
  };

/** 科目配色，让预算条一眼可区分 */
const CATEGORY_COLORS: Record<string, string> = {
  transport: "bg-sky-500",
  accommodation: "bg-violet-500",
  food: "bg-amber-500",
  activities: "bg-emerald-500",
  shopping: "bg-pink-500",
  contingency: "bg-gray-500",
};

/** 报价来源徽标 */
function QuoteBadge({ confidence }: { confidence: "live" | "estimate" }) {
  if (confidence === "live") {
    return (
      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
        实时报价
      </span>
    );
  }

  return (
    <span className="rounded bg-gray-500/15 px-2 py-0.5 text-xs text-gray-400">估算值</span>
  );
}

/** 键值对展示 */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}

/** 单个预算科目卡片 */
function CategoryCard({ category }: { category: BudgetCategory }) {
  const percent = Math.round(category.ratio * 100);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-300">{category.label}</span>
        {category.lockedByQuote && (
          <span className="text-xs text-emerald-400" title="金额来自询价结果">
            已锁定
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl font-semibold text-white">{category.amount}</span>
        <span className="text-xs text-gray-400">元</span>
        <span className="ml-auto text-xs text-gray-400">{percent}%</span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full ${CATEGORY_COLORS[category.key] ?? "bg-gray-500"}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-gray-500">
        人均 {category.perPerson} 元 · {category.detail}
      </p>
    </div>
  );
}

/** 交通与住宿的真实信息卡 */
function QuoteSection({ plan }: { plan: TravelPlan }) {
  const { flight, hotel } = plan.quotes;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {flight && (
        <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-white">往返交通</h3>
            <QuoteBadge confidence={flight.confidence} />
          </div>

          <div className="mt-3 space-y-2 text-sm">
            {[...flight.outbound, ...flight.inbound].map((leg, index) => (
              <div
                key={`${leg.flightNumber}-${index}`}
                className="flex items-center gap-3 text-gray-300"
              >
                <span className="font-mono text-xs text-gray-400">
                  {leg.departAt.slice(5, 16).replace("T", " ")}
                </span>
                <span className="text-white">
                  {leg.from} → {leg.to}
                </span>
                <span className="ml-auto font-mono text-xs text-gray-400">{leg.flightNumber}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-gray-800 pt-3">
            <Fact label="单人往返" value={`${flight.pricePerAdult} 元`} />
            <Fact label="合计" value={`${flight.totalPrice} 元`} />
            <Fact
              label="全程耗时"
              value={formatDuration(flight.totalDurationMinutes)}
            />
          </div>

          <p className="mt-3 text-xs text-gray-400">{flight.note}</p>
        </div>
      )}

      <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-white">住宿</h3>
          {hotel ? <QuoteBadge confidence={hotel.confidence} /> : <span className="text-xs text-gray-400">无需住宿</span>}
        </div>

        {hotel ? (
          <>
            <p className="mt-3 text-sm text-white">{hotel.name}</p>

            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-gray-800 pt-3">
              <Fact label="房间数" value={`${hotel.rooms} 间`} />
              <Fact label="每晚" value={`${hotel.pricePerNight} 元`} />
              <Fact label="合计" value={`${hotel.totalPrice} 元`} />
            </div>

            {/*
              预订链接做成按钮而非写进说明文本：URL 混在长段落里
              既占篇幅又不可点击，用户得手动复制。
              目前只有 RollingGo 提供可直接下单的链接。
            */}
            {hotel.bookingUrl && (
              <a
                href={hotel.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300 transition hover:border-sky-400 hover:bg-sky-500/20 hover:text-sky-200"
              >
                查看房型并预订
                <span aria-hidden="true">↗</span>
              </a>
            )}

            {/*
              房型明细来自选定酒店的二次查价（getHotelDetail）。
              只列前 4 个：列表越长越难比较，而最低价已在上方「每晚」体现。
            */}
            {plan.hotelRooms && plan.hotelRooms.length > 0 && (
              <div className="mt-3 border-t border-gray-800 pt-3">
                <p className="text-xs text-gray-400">
                  可选房型 <span className="text-gray-400">（含早与退改说明，按价格排序）</span>
                </p>

                <ul className="mt-2 space-y-1.5">
                  {plan.hotelRooms.slice(0, 4).map((room, index) => (
                    <li
                      key={`${room.roomName}-${index}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs"
                    >
                      <span className="w-20 shrink-0 text-amber-400">¥{room.averagePrice}</span>
                      <span className="min-w-0 flex-1 text-gray-300">{room.roomName}</span>
                      <span className="shrink-0 text-gray-400">
                        {[room.bedType, room.meal, room.size ? `${room.size}㎡` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {room.cancelable && (
                        <span className="shrink-0 rounded bg-emerald-500/10 px-1 text-[12px] sm:text-[10px] text-emerald-400">
                          可免费取消
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-3 text-xs text-gray-400">{hotel.note}</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-gray-400">当日往返行程，不涉及住宿安排。</p>
        )}
      </div>
    </div>
  );
}

/**
 * 跨城方式对比（火车 / 自驾）。
 *
 * 排序由后端给出（按人均价升序），前端不再重排 ——
 * 保持「哪里算的就在哪里定序」，避免两端规则不一致。
 */
function IntercitySection({ plan }: { plan: TravelPlan }) {
  const options = plan.intercityOptions;

  if (!options || options.length === 0) return null;

  /** 把分钟格式化为「4小时24分」 */
  const dur = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) return "—";

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return h > 0 ? `${h}小时${m}分` : `${m}分`;
  };

  // 最便宜的方案作为「推荐」标记
  const cheapest = options.reduce((a, b) => (b.perPerson < a.perPerson ? b : a));
  const fastest = options.reduce((a, b) => (b.durationMinutes < a.durationMinutes ? b : a));

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-medium text-white">跨城方式</h2>
        <span className="text-xs text-gray-400">
          单程对比（火车为实时票价与余票，自驾含油费与过路费）
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800">
        {options.map((option, index) => {
          const isCheapest = option === cheapest;
          const isFastest = option === fastest;

          return (
            <div
              key={`${option.mode}-${option.reference}-${index}`}
              className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 ${
                index > 0 ? "border-t border-gray-800" : ""
              } ${isCheapest ? "bg-gray-950/60" : "bg-gray-950/30"}`}
            >
              <span className="w-14 shrink-0 text-xs text-gray-400">{option.label}</span>

              <span className="w-24 shrink-0 font-mono text-sm text-white">
                {option.departTime ? `${option.departTime}-${option.arriveTime}` : "—"}
              </span>

              <span className="w-20 shrink-0 text-xs text-gray-400">
                {dur(option.durationMinutes)}
              </span>

              <span className="w-20 shrink-0 text-sm text-white">
                ¥{option.perPerson}
                <span className="text-xs text-gray-400">/人</span>
              </span>

              {/*
                徽标紧跟价格列，而不是推到最右。
                原来放在最右端时，扫视价格列会完全看不到徽标 ——
                用户需要横向跨过整段说明文字才能发现「最低价」。
              */}
              <span className="w-24 shrink-0">
                {isCheapest && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[12px] sm:text-[10px] text-emerald-400">
                    最低价
                  </span>
                )}
                {isFastest && (
                  <span
                    className={`rounded bg-sky-500/15 px-1.5 py-0.5 text-[12px] sm:text-[10px] text-sky-400 ${
                      isCheapest ? "ml-1" : ""
                    }`}
                  >
                    最快
                  </span>
                )}
                {option.confidence === "estimate" && (
                  <span className="rounded bg-gray-500/15 px-1.5 py-0.5 text-[12px] sm:text-[10px] text-gray-400">
                    估算
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1 text-xs text-gray-400">{option.breakdown}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-gray-400">
        火车票价与余票来自飞常准实时数据；自驾里程、时长与过路费来自高德路径规划，
        油费按 {VEHICLE_DEFAULTS.fuelPer100Km} 升/百公里、{VEHICLE_DEFAULTS.fuelPricePerLiter} 元/升估算。
      </p>
    </section>
  );
}

/** 单日活动时间线 */
function DayCard({
  day,
  nights,
  plan,
}: {
  day: TravelPlan["itinerary"][number];
  nights: number;
  plan: TravelPlan;
}) {
  /**
   * 当日路线图。按游览顺序给有坐标的活动编号，
   * 少于两个坐标时不画（一个点无法表达路线）。
   */
  const mapPoints = day.activities
    .filter((a) => typeof a.coordinates === "string" && a.coordinates.length > 0)
    .map((a, index) => ({ location: a.coordinates as string, index: index + 1 }));

  // 优先用真实道路折线；没有时回退直连（直连会穿过不可通行区域）
  const dayPolyline = plan.dayRoutePolylines?.[day.day] ?? null;

  const mapUrl = buildDayMapUrlSafe(mapPoints, dayPolyline);

  const hasRealRoute = Boolean(dayPolyline);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-800 px-4 py-3">
        <span className="rounded bg-sky-500/15 px-2 py-0.5 text-xs text-sky-400">
          Day {day.day}
        </span>
        <span className="text-sm text-white">{day.theme}</span>
        <span className="font-mono text-xs text-gray-400">{day.date}</span>
        <span className="ml-auto text-xs text-gray-400">
          当日花费约 <span className="text-amber-400">{day.estimatedCost}</span> 元
        </span>
      </div>

      <div className="divide-y divide-gray-800/60">
        {day.activities.map((activity, index) => {
          const meta = KIND_META[activity.kind];

          return (
            <div key={`${activity.title}-${index}`} className="flex gap-4 px-4 py-3">
              <div className="w-24 shrink-0 pt-0.5 text-right">
                <div className="font-mono text-xs text-gray-400">{activity.startTime}</div>
                <div className="font-mono text-xs text-gray-400">{activity.endTime}</div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs ${meta.color}`}>{meta.icon}</span>
                  <span className="text-sm text-white">{activity.title}</span>
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[12px] sm:text-[10px] text-gray-400">
                    {meta.label}
                  </span>
                  {activity.estimatedCost > 0 && (
                    <span className="text-xs text-amber-400">约 {activity.estimatedCost} 元</span>
                  )}
                </div>

                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                  {activity.description}
                </p>

                {activity.location && (
                  <p className="mt-1 text-xs text-gray-400">
                    地点：{activity.location}
                    {activity.address && activity.address !== activity.location && (
                      <span className="text-gray-400">（{activity.address}）</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 border-t border-gray-800 px-4 py-2 text-xs text-gray-400">
        <span>住宿：{day.accommodation}</span>
        {nights === 0 && <span className="text-gray-400">（一日游）</span>}
      </div>

      {mapUrl && (
        <div className="border-t border-gray-800 px-4 py-3">
          <p className="mb-2 text-xs text-gray-400">
            当日路线{" "}
            <span className="text-gray-400">
              （编号对应下方活动顺序{hasRealRoute ? "，连线为实际道路" : "，连线为直线示意"}）
            </span>
          </p>
          {/* 静态图由高德生成，逐日一张；用原生 img 而非 next/image，
              因为图片来自外部域名且尺寸固定，无需优化管线 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapUrl}
            alt={`第 ${day.day} 天路线图`}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            loading="lazy"
            className="w-full rounded border border-gray-800"
          />
        </div>
      )}

      {day.commuteLegs && day.commuteLegs.length > 0 && (
        <div className="border-t border-gray-800 bg-gray-900/30 px-4 py-2">
          <p className="text-xs text-gray-400">
            当日通勤 <span className="text-gray-400">（高德地图实测）</span>
          </p>
          <ul className="mt-1 space-y-0.5">
            {day.commuteLegs.map((leg) => (
              <li key={`${leg.from}-${leg.to}`} className="text-xs text-gray-400">
                {leg.mode === "walk" ? "🚶" : "🚇"} {leg.from} → {leg.to}：
                <span className="text-cyan-400"> {leg.durationMinutes} 分钟</span>
                <span className="text-gray-400">
                  {" "}
                  / {(leg.distanceMeters / 1000).toFixed(1)} 公里
                </span>
                {leg.summary && <span className="text-gray-400">　{leg.summary}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {day.tips && (
        <div className="border-t border-gray-800 px-4 py-2 text-xs text-sky-300/80">
          提示：{day.tips}
        </div>
      )}
    </div>
  );
}

/** 顶部信息条 */
function PlanHeader({ plan, planId }: { plan: TravelPlan; planId?: number | null }) {
  const { query, duration, budget } = plan;
  const headcount = query.party.adults + query.party.children;

  const liveCount =
    (plan.quotes.flight?.confidence === "live" ? 1 : 0) +
    (plan.quotes.hotel?.confidence === "live" ? 1 : 0);

  return (
    <div className="rounded-xl border border-gray-800 bg-gradient-to-b from-gray-900/80 to-black p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {query.origin} → {query.destination}
          </h2>

          <p className="mt-1 text-sm text-gray-400">
            {query.departDate} 至 {query.returnDate} · {duration.days} 天 {duration.nights} 晚 ·{" "}
            {headcount} 人（成人 {query.party.adults}
            {query.party.children > 0 ? ` / 儿童 ${query.party.children}` : ""}）
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300">
            {STYLE_LABELS[query.style]}
          </span>
          {liveCount > 0 ? (
            <span className="rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-400">
              含实时报价
            </span>
          ) : (
            <span className="rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-400">
              估算模式
            </span>
          )}
          <span className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400">
            {plan.generatedByAI ? "AI 编排" : "模板生成"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-800 pt-4 md:grid-cols-4">
        <Fact label="总预算" value={`${budget.total} 元`} />
        <Fact label="人均" value={`${budget.perPerson} 元`} />
        <Fact label="人均每日" value={`${budget.perPersonPerDay} 元`} />
        <Fact
          label="预算可行性"
          value={budget.feasible ? "覆盖主要支出" : `缺口 ${budget.minimumViable - budget.total} 元`}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {planId != null && (
          <p className="text-xs text-gray-400">
            方案编号 <span className="font-mono text-gray-400">#{planId}</span> · 分享链接{" "}
            <Link href={`/agent-travel/${planId}`} className="text-sky-400 hover:text-sky-300">
              /travel/{planId}
            </Link>
          </p>
        )}

        {/*
          下载按钮用原生 <a> 而非 fetch + Blob：
          文档由服务端生成，直接让浏览器走下载流程更简单，
          且能正确处理 Content-Disposition 里的中文文件名。
        */}
        {planId != null && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/travel/${planId}/download`}
              className="inline-flex items-center gap-1.5 rounded border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300 transition hover:border-sky-400 hover:bg-sky-500/20 hover:text-sky-200"
            >
              <span aria-hidden="true">⬇</span>
              下载行程单（Word）
            </a>

            <a
              href={`/api/travel/${planId}/download?mode=compact`}
              className="inline-flex items-center gap-1.5 rounded border border-gray-700 bg-gray-900/60 px-3 py-1.5 text-xs text-gray-300 transition hover:border-gray-600 hover:text-white"
            >
              精简版
            </a>

            {/*
              单日版用 details 折叠，避免一次性铺开 N 个按钮把头部撑长。
              行程天数通常 3-7 天，按钮数可控。
            */}
            <details className="relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded border border-gray-700 bg-gray-900/60 px-3 py-1.5 text-xs text-gray-300 transition hover:border-gray-600 hover:text-white">
                单日版
                <span aria-hidden="true">▾</span>
              </summary>

              <div className="absolute left-0 z-10 mt-1 flex min-w-max flex-col overflow-hidden rounded border border-gray-700 bg-gray-950 shadow-lg">
                {plan.itinerary.map((day) => (
                  <a
                    key={day.day}
                    href={`/api/travel/${planId}/download?mode=day&day=${day.day}`}
                    className="whitespace-nowrap px-3 py-1.5 text-xs text-gray-300 transition hover:bg-gray-900 hover:text-white"
                  >
                    第 {day.day} 天（{day.date}）
                  </a>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

/** 主体：完整方案 */
export default function PlanView({
  plan,
  planId,
  warnings = [],
}: {
  plan: TravelPlan;
  planId?: number | null;
  warnings?: string[];
}) {
  const allWarnings = [...new Set([...warnings, ...plan.warnings])];

  return (
    <div className="space-y-6">
      <PlanHeader plan={plan} planId={planId} />

      {allWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
          <h3 className="text-sm font-medium text-amber-400">生成说明</h3>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-amber-200/80">
            {allWarnings.map((warning) => (
              <li key={warning}>· {warning}</li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">行程总览</h3>
        <p className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-sm leading-relaxed text-gray-300">
          {plan.overview}
        </p>
      </section>

      {plan.weather && plan.weather.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-white">
            天气预报
            <span className="ml-2 text-sm font-normal text-gray-400">高德 · 仅中国境内</span>
          </h3>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {plan.weather
              .filter((w) =>
                plan.itinerary.some((d) => d.date === w.date),
              )
              .map((w) => (
                <div
                  key={w.date}
                  className="rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs text-gray-400">{w.date}</span>
                    <span className="text-xs text-gray-400">
                      {w.nightTemp}~{w.dayTemp}℃
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white">
                    {w.dayWeather}
                    {w.nightWeather && w.nightWeather !== w.dayWeather && (
                      <span className="text-gray-400"> 转 {w.nightWeather}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {w.windDirection} {w.windPower} 级
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">交通与住宿</h3>
        <QuoteSection plan={plan} />

        <IntercitySection plan={plan} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold text-white">预算分配</h3>
          <span className="text-xs text-gray-400">
            各项合计 {plan.budget.allocated} 元 = 总预算 {plan.budget.total} 元
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plan.budget.categories.map((category) => (
            <CategoryCard key={category.key} category={category} />
          ))}
        </div>

        {plan.budget.diagnosis.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-xs leading-relaxed text-gray-400">
            {plan.budget.diagnosis.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">
          逐日行程
          <span className="ml-2 text-sm font-normal text-gray-400">
            共 {plan.itinerary.length} 天
          </span>
        </h3>

        <div className="space-y-4">
          {plan.itinerary.map((day) => (
            <DayCard key={day.date} day={day} nights={plan.duration.nights} plan={plan} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="mb-3 text-lg font-semibold text-white">行前准备</h3>
          <ul className="space-y-2 rounded-lg border border-gray-800 bg-gray-950/40 p-4">
            {plan.checklist.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-gray-300">
                <span className="text-sky-400">☐</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold text-white">出行提示</h3>
          <ul className="space-y-2 rounded-lg border border-gray-800 bg-gray-950/40 p-4">
            {plan.tips.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-gray-300">
                <span className="text-amber-400">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-xs text-gray-400">
        方案生成于 {plan.generatedAt.slice(0, 19).replace("T", " ")}
        {plan.model ? ` · 模型 ${plan.model}` : ""}
        {plan.quotes.flight?.confidence === "estimate"
          ? " · 价格含估算成分，预订前请以航司与酒店实际报价为准"
          : ""}
      </p>
    </div>
  );
}
