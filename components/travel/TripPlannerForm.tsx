"use client";

/**
 * 旅行需求表单 + 结果展示（客户端组件）。
 *
 * 表单字段与 TripQuery 一一对应，前端做即时校验（快速反馈），
 * 服务端仍会再校验一次（不可信输入），两边规则保持一致。
 */

import { useState } from "react";

import type { TravelPlan } from "@/lib/agents/travel/types";

import PlanView from "./PlanView";

/** 预算档位选项 */
const STYLE_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "budget", label: "经济型", hint: "快捷酒店 / 青旅，优先省钱" },
  { value: "comfort", label: "舒适型", hint: "三四星酒店，性价比均衡" },
  { value: "premium", label: "品质型", hint: "四五星酒店，体验优先" },
  { value: "luxury", label: "奢享型", hint: "五星或度假村，不将就" },
];

/** 常用偏好标签，点击即添加 */
const INTEREST_PRESETS = [
  "美食",
  "博物馆",
  "自然风光",
  "历史古迹",
  "主题乐园",
  "购物",
  "摄影",
  "徒步",
  "温泉",
  "夜生活",
  "亲子",
  "小众秘境",
];

/** 表单状态 */
interface FormState {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  children: number;
  budget: number;
  style: string;
  interests: string[];
  notes: string;
}

/** 在指定日期上加减天数，返回 YYYY-MM-DD */
function shiftDate(base: string, days: number): string {
  const timestamp = Date.parse(`${base}T00:00:00Z`);

  if (Number.isNaN(timestamp)) {
    return base;
  }

  return new Date(timestamp + days * 86_400_000).toISOString().slice(0, 10);
}

/** 今天的 YYYY-MM-DD（本地时区） */
function todayString(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/** 初始值：默认 5 天 4 晚，避免用户面对空表单 */
function initialState(): FormState {
  const depart = shiftDate(todayString(), 7);

  return {
    origin: "",
    destination: "",
    departDate: depart,
    returnDate: shiftDate(depart, 4),
    adults: 2,
    children: 0,
    budget: 8000,
    style: "comfort",
    interests: [],
    notes: "",
  };
}

/** 输入框统一样式，避免重复类名 */
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30";

const LABEL_CLASS = "mb-1.5 block text-xs text-gray-400";

export default function TripPlannerForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  /** 更新单个字段 */
  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  /** 切换偏好标签 */
  function toggleInterest(tag: string): void {
    setForm((previous) => ({
      ...previous,
      interests: previous.interests.includes(tag)
        ? previous.interests.filter((item) => item !== tag)
        : [...previous.interests, tag],
    }));
  }

  /** 前端预校验，规则与服务端一致 */
  function validate(): string[] {
    const issues: string[] = [];

    if (!form.origin.trim()) {
      issues.push("请填写出发城市");
    }

    if (!form.destination.trim()) {
      issues.push("请填写目的地");
    }

    if (form.origin.trim() && form.origin.trim() === form.destination.trim()) {
      issues.push("出发城市与目的地不能相同");
    }

    if (!form.departDate || !form.returnDate) {
      issues.push("请填写去程与返程日期");
    } else if (form.returnDate < form.departDate) {
      issues.push("返程日期不能早于去程日期");
    }

    if (form.adults < 1) {
      issues.push("至少 1 位成人");
    }

    if (form.budget < 100) {
      issues.push("预算至少 100 元");
    }

    return issues;
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    const issues = validate();

    if (issues.length > 0) {
      setErrors(issues);
      setWarnings([]);
      return;
    }

    setLoading(true);
    setErrors([]);
    setWarnings([]);

    try {
      const response = await fetch("/api/travel/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          departDate: form.departDate,
          returnDate: form.returnDate,
          party: { adults: form.adults, children: form.children },
          budget: form.budget,
          style: form.style,
          interests: form.interests,
          notes: form.notes.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: TravelPlan;
        id?: number | null;
        warnings?: string[];
        message?: string;
        errors?: string[];
      };

      if (!response.ok || !payload.success || !payload.data) {
        setErrors(payload.errors ?? [payload.message ?? "生成失败，请稍后重试"]);
        return;
      }

      setPlan(payload.data);
      setPlanId(payload.id ?? null);
      setWarnings(payload.warnings ?? []);

      // 结果区在页面下方，生成后滚动过去，避免用户以为没反应
      requestAnimationFrame(() => {
        document.getElementById("travel-result")?.scrollIntoView({ behavior: "smooth" });
      });
    } catch (error) {
      setErrors([`请求失败：${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setLoading(false);
    }
  }

  const nights = Math.max(0, Math.round((Date.parse(`${form.returnDate}T00:00:00Z`) - Date.parse(`${form.departDate}T00:00:00Z`)) / 86_400_000));
  const days = Number.isFinite(nights) ? nights + 1 : 0;
  const headcount = form.adults + form.children;

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-800 bg-gray-950/40 p-6"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="origin">
              出发城市
            </label>
            <input
              id="origin"
              className={INPUT_CLASS}
              placeholder="如 北京、上海，或直接填三字码 PEK"
              value={form.origin}
              onChange={(event) => update("origin", event.target.value)}
              autoComplete="off"
            />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="destination">
              目的地
            </label>
            <input
              id="destination"
              className={INPUT_CLASS}
              placeholder="如 东京、曼谷、三亚，或三字码 NRT"
              value={form.destination}
              onChange={(event) => update("destination", event.target.value)}
              autoComplete="off"
            />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="departDate">
              去程日期
            </label>
            <input
              id="departDate"
              type="date"
              className={INPUT_CLASS}
              value={form.departDate}
              onChange={(event) => {
                const next = event.target.value;
                update("departDate", next);

                // 去程晚于返程时自动把返程顺延，维持 4 晚的默认节奏
                if (next && form.returnDate && form.returnDate < next) {
                  update("returnDate", shiftDate(next, 4));
                }
              }}
            />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="returnDate">
              返程日期
            </label>
            <input
              id="returnDate"
              type="date"
              className={INPUT_CLASS}
              value={form.returnDate}
              min={form.departDate}
              onChange={(event) => update("returnDate", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS} htmlFor="adults">
                成人
              </label>
              <input
                id="adults"
                type="number"
                min={1}
                max={30}
                className={INPUT_CLASS}
                value={form.adults}
                onChange={(event) => update("adults", Number(event.target.value))}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="children">
                儿童（2-12 岁）
              </label>
              <input
                id="children"
                type="number"
                min={0}
                max={30}
                className={INPUT_CLASS}
                value={form.children}
                onChange={(event) => update("children", Number(event.target.value))}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="budget">
              总预算（元，全部同行人）
            </label>
            <input
              id="budget"
              type="number"
              min={100}
              step={100}
              className={INPUT_CLASS}
              value={form.budget}
              onChange={(event) => update("budget", Number(event.target.value))}
            />
            {days > 0 && headcount > 0 && form.budget > 0 && (
              <p className="mt-1.5 text-xs text-gray-500">
                {days} 天 {nights} 晚 · {headcount} 人 · 人均{" "}
                {Math.round(form.budget / headcount)} 元 · 人均每日{" "}
                <span
                  className={
                    form.budget / headcount / days < 150 ? "text-amber-400" : "text-gray-400"
                  }
                >
                  {Math.round(form.budget / headcount / days)} 元
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <span className={LABEL_CLASS}>预算档位</span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STYLE_OPTIONS.map((option) => {
              const active = form.style === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("style", option.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    active
                      ? "border-sky-500/60 bg-sky-500/10"
                      : "border-gray-800 bg-gray-950 hover:border-gray-700"
                  }`}
                >
                  <span className={`block text-sm ${active ? "text-sky-300" : "text-white"}`}>
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-gray-500">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <span className={LABEL_CLASS}>偏好（可多选，可不选）</span>
          <div className="flex flex-wrap gap-2">
            {INTEREST_PRESETS.map((tag) => {
              const active = form.interests.includes(tag);

              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleInterest(tag)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : "border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-200"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <label className={LABEL_CLASS} htmlFor="notes">
            补充要求（可选）
          </label>
          <textarea
            id="notes"
            rows={2}
            className={INPUT_CLASS}
            placeholder="如：带 70 岁老人，节奏要慢；不吃辣；想住在地铁站附近"
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </div>

        {errors.length > 0 && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <ul className="space-y-1 text-xs text-red-300">
              {errors.map((error) => (
                <li key={error}>· {error}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500 sm:w-auto sm:px-8"
        >
          {loading ? "正在询价并编排行程…" : "生成旅行方案"}
        </button>

        {loading && (
          <p className="mt-2 text-xs text-gray-500">
            正在查询交通与住宿报价，并调用模型编排逐日行程，通常需要 10-40 秒
          </p>
        )}
      </form>

      {plan && (
        <div id="travel-result">
          <PlanView plan={plan} planId={planId} warnings={warnings} />
        </div>
      )}
    </div>
  );
}
