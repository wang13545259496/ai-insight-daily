"use client";

import { useEffect, useState } from "react";

/**
 * 「自上次访问以来」的新增标记。
 *
 * ## 为什么需要
 *
 * 维护者的用法是「每天扫一眼有没有值得关注的新动态」。
 * 首页有 20 条新闻，但每天新增约 25 条 —— 昨天看过的和今天新增的混在一起，
 * 每次都要重新回忆「这条我是不是看过了」。
 *
 * 记住上次访问时间后，新增的条目标一个 NEW，扫一眼就知道该看哪几条。
 *
 * ## 为什么用 localStorage 而不是 Cookie
 *
 * Cookie 方案可以在服务端直接渲染出标记，没有闪烁；
 * 但要在中间件里写 Cookie，而中间件是全局生效的，改动风险比收益大。
 * localStorage 只在客户端读，实现简单、不碰服务端逻辑。
 *
 * 代价是标记在 hydration 之后才出现（约一帧）。对「每天看一眼」的场景
 * 这个闪烁可以接受。
 *
 * ## 为什么用模块级缓存
 *
 * 20 条新闻各渲染一个 NewBadge，若每个都读一次 localStorage 会有 20 次读取，
 * 而且如果「记住访问时间」的组件先执行，会把基线提前写成现在，
 * 导致所有标记失效。
 *
 * 因此：第一次读时缓存到模块变量，所有 badge 共用同一次读取结果；
 * 写入新基线放在独立的 RememberVisit 里，且用 useEffect 保证在渲染之后执行。
 *
 * ## 首次访问的行为
 *
 * 没有历史记录时不标任何 NEW —— 否则第一次打开会满屏 NEW，毫无意义。
 * 同时把当前时间记为基线，第二次访问才有效。
 */

const STORAGE_KEY = "ai-insight-daily:last-visit-at";

/** undefined = 尚未读取；null = 读过但没有记录 */
let cachedLastVisit: number | null | undefined = undefined;

function readLastVisit(): number | null {
  if (cachedLastVisit !== undefined) return cachedLastVisit;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    cachedLastVisit = Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    // 隐私模式 / 禁用存储时直接当作首次访问
    cachedLastVisit = null;
  }

  return cachedLastVisit;
}

/**
 * 单条新闻的 NEW 标记。
 *
 * @param at 该条新闻的时间戳（毫秒）
 */
export function NewBadge({ at }: { at: number | null | undefined }) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!at || !Number.isFinite(at)) return;

    const last = readLastVisit();

    // 首次访问（last === null）不标记
    if (last !== null && at > last) {
      setIsNew(true);
    }
  }, [at]);

  if (!isNew) return null;

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-sm bg-red-600 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide text-white"
      title="上次访问之后新增"
    >
      NEW
    </span>
  );
}

/**
 * 记录本次访问时间，供下次比较。
 *
 * 必须放在页面靠后的位置，且只能有一个 ——
 * 它会在挂载后把基线更新为「现在」。
 */
export function RememberVisit() {
  useEffect(() => {
    try {
      const now = Date.now();
      window.localStorage.setItem(STORAGE_KEY, String(now));
      // 缓存也更新，避免同一页面里后续挂载的 badge 用到旧值
      cachedLastVisit = now;
    } catch {
      // 忽略：存储不可用时不记录，退化为「每次都是首次访问」
    }
  }, []);

  return null;
}
