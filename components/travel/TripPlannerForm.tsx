"use client";

/**
 * 旅行需求表单 + 结果展示（客户端组件）。
 *
 * 表单字段与 TripQuery 一一对应，前端做即时校验（快速反馈），
 * 服务端仍会再校验一次（不可信输入），两边规则保持一致。
 */

import { useEffect, useState } from "react";

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

/** 生成阶段清单，用于在等待期间显示进度 */
const PROGRESS_STEPS = [
  "校验行程参数",
  "查询交通与住宿价格",
  "AI 正在编排逐日行程",
  "获取景点坐标与真实通勤",
  "重新编排",
  "生成最终方案",
];

/** 生成结果（成功或失败） */
interface StreamResult {
  success: boolean;
  data?: TravelPlan;
  id?: number | null;
  warnings?: string[];
  message?: string;
  errors?: string[];
  /** 服务端在需要访问口令时返回 TRAVEL_AUTH_REQUIRED */
  code?: string;
}

/**
 * 判断结果是否表示「需要先登录」。
 *
 * 双重判断：服务端返回的 code 是主依据，message 作为兜底 ——
 * 若以后有人改了响应文案或漏传 code，仍能正确跳登录页而不是
 * 把「需要访问口令」当成普通错误显示。
 */
function isAuthRequired(payload: StreamResult): boolean {
  return payload.code === "TRAVEL_AUTH_REQUIRED" || /访问口令/.test(payload.message ?? "");
}

/** 跳到登录页，并记住回来后要继续的动作 */
function goToLogin(): void {
  window.location.href = `/travel/login?next=${encodeURIComponent("/travel")}`;
}

/**
 * 带进度回调地调用生成接口。
 *
 * 用流式（NDJSON）而不是普通 JSON：一次生成要 40-60 秒，
 * 普通响应期间页面毫无反馈，用户会以为卡死。服务端每完成一个阶段
 * 推一行 JSON，这里逐行解析并回调进度。
 *
 * 若服务端未按流式返回（校验失败会直接返回 JSON），回退为一次性解析。
 */
async function generateWithProgress(
  payload: unknown,
  onProgress: (message: string) => void,
): Promise<StreamResult> {
  const response = await fetch("/api/travel/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("x-ndjson")) {
    return (await response.json()) as StreamResult;
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("浏览器不支持流式响应");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let result: StreamResult | null = null;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    // 最后一段可能是不完整的行，留到下一轮拼接
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      try {
        const message = JSON.parse(trimmed) as {
          type?: string;
          message?: string;
        } & StreamResult;

        if (message.type === "progress") {
          onProgress(message.message ?? "处理中");
        } else if (message.type === "done") {
          result = message;
        }
      } catch {
        // 单行解析失败不应中断整个流程
      }
    }
  }

  if (!result) {
    throw new Error("生成未返回结果，请重试");
  }

  return result;
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

/**
 * 草稿存储键。
 *
 * 为什么需要：未登录用户在填完表单、点「生成」后会被引导到登录页，
 * 登录成功再回到本页时客户端组件会重新挂载，表单内容随之清空 ——
 * 用户得重填一遍，体验很差。
 *
 * 用 sessionStorage 而非 localStorage：草稿只在本次会话内有效，
 * 关掉标签页即失效，避免下次打开时看到一份来路不明的旧表单。
 */
const DRAFT_KEY = "travel-form-draft";

/** 保存草稿（失败时静默忽略，隐私模式下 sessionStorage 可能不可用） */
function saveDraft(form: FormState): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  } catch {
    // 忽略：草稿只是体验优化，存不下也不该影响主流程
  }
}

/** 读取草稿；没有或解析失败时返回 null */
function loadDraft(): FormState | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<FormState>;

    // 逐字段校验：草稿可能来自旧版本，缺字段会让表单渲染出 undefined
    const base = initialState();

    return {
      origin: typeof parsed.origin === "string" ? parsed.origin : base.origin,
      destination: typeof parsed.destination === "string" ? parsed.destination : base.destination,
      departDate: typeof parsed.departDate === "string" ? parsed.departDate : base.departDate,
      returnDate: typeof parsed.returnDate === "string" ? parsed.returnDate : base.returnDate,
      adults: Number.isFinite(parsed.adults) ? Number(parsed.adults) : base.adults,
      children: Number.isFinite(parsed.children) ? Number(parsed.children) : base.children,
      budget: Number.isFinite(parsed.budget) ? Number(parsed.budget) : base.budget,
      style: typeof parsed.style === "string" ? parsed.style : base.style,
      interests: Array.isArray(parsed.interests)
        ? parsed.interests.filter((i): i is string => typeof i === "string")
        : base.interests,
      notes: typeof parsed.notes === "string" ? parsed.notes : base.notes,
    };
  } catch {
    return null;
  }
}

/** 清除草稿（生成成功后不必再保留） */
function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // 忽略
  }
}

/** 输入框统一样式，避免重复类名 */
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30";

const LABEL_CLASS = "mb-1.5 block text-xs text-gray-400";

export default function TripPlannerForm({ historySlot }: { historySlot?: React.ReactNode }) {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState("");

  /**
   * 挂载后恢复草稿。
   *
   * 放在 useEffect 而不是 useState 的惰性初始化里：服务端渲染时
   * sessionStorage 不存在，惰性初始化会因两端结果不同导致 hydration 警告。
   * 挂载后再填，渲染结果始终一致。
   */
  useEffect(() => {
    const draft = loadDraft();

    if (draft) setForm(draft);
  }, []);

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
    setProgress("正在提交请求");

    try {
      const payload = await generateWithProgress(
        {
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          departDate: form.departDate,
          returnDate: form.returnDate,
          party: { adults: form.adults, children: form.children },
          budget: form.budget,
          style: form.style,
          interests: form.interests,
          notes: form.notes.trim() || undefined,
        },
        setProgress,
      );

      /**
       * 未登录时跳登录页，而不是把「需要访问口令」当成普通错误显示 ——
       * 用户看到一行红字不知道该做什么，直接给登录入口更明确。
       *
       * 跳转前保存草稿：登录后回到本页时表单会重新挂载，
       * 不保存的话用户得把刚填的内容重填一遍。
       */
      if (isAuthRequired(payload)) {
        saveDraft(form);
        setProgress("需要登录，正在跳转…");
        goToLogin();
        return;
      }

      if (!payload.success || !payload.data) {
        setErrors(payload.errors ?? [payload.message ?? "生成失败，请稍后重试"]);
        return;
      }

      // 生成成功，草稿使命结束
      clearDraft();

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
      setProgress("");
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
          {loading ? "正在生成…" : "生成旅行方案"}
        </button>

        {loading && (
          <div className="mt-4 rounded-lg border border-sky-500/25 bg-sky-500/5 p-4">
            <div className="flex items-center gap-3">
              {/* 旋转指示：让「在处理」这件事有视觉反馈 */}
              <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-sky-400/30 border-t-sky-400" />
              <span className="text-sm text-sky-300">{progress || "正在处理"}</span>
            </div>

            <ul className="mt-3 space-y-0.5 text-xs text-gray-500">
              {PROGRESS_STEPS.map((step) => {
                const activeIndex = PROGRESS_STEPS.findIndex((s) => progress.includes(s));
                const thisIndex = PROGRESS_STEPS.indexOf(step);
                const done = activeIndex > thisIndex;
                const current = activeIndex === thisIndex;

                return (
                  <li
                    key={step}
                    className={
                      done ? "text-emerald-400/70" : current ? "text-sky-300" : "text-gray-600"
                    }
                  >
                    {done ? "✓" : current ? "▸" : "·"} {step}
                  </li>
                );
              })}
            </ul>

            <p className="mt-3 border-t border-white/5 pt-3 text-xs text-gray-500">
              完整生成含询价、模型编排、地图通勤计算与质量校验，通常需要 30-60 秒
            </p>
          </div>
        )}
      </form>

      {plan && (
        <div id="travel-result">
          <PlanView plan={plan} planId={planId} warnings={warnings} />
        </div>
      )}

      {/*
        历史方案列表由页面（服务端组件）渲染后作为插槽传入。
        这样做的原因：列表需要在服务端按登录态决定是否查询数据库 ——
        未登录时不该把用户的行程记录发到浏览器，
        因此不能在客户端组件里用 isAuthed 去「隐藏」已经下发的数据。
      */}
      {historySlot}
    </div>
  );
}
