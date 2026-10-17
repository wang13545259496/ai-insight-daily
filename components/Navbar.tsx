"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { name: "首页", href: "/" },
  { name: "AI资讯", href: "/news" },
  { name: "事件中心", href: "/events" },
  { name: "实体库", href: "/entities" },
  { name: "产业趋势", href: "/industry" },
  { name: "Agent生态", href: "/agent" },
  { name: "模型生态", href: "/models" },
  { name: "机会地图", href: "/opportunity-map" },
  { name: "投资观察", href: "/investment" },
  { name: "预测", href: "/trend/predict" },
  { name: "AI 出行管家", href: "/agent-travel" },
];

/**
 * 全站导航。
 *
 * 宽屏：11 项平铺一行。
 * 窄屏（< lg）：收进汉堡菜单。
 *
 * ## 为什么必须做移动端收纳
 *
 * 11 个导航项全部是 whitespace-nowrap，在 375px 宽度下会横向溢出，
 * 右侧直接被裁掉 —— 实测移动端只能看到前 4 项，后面 7 个入口点不到。
 * 这不是"不够美观"，是功能缺失。
 *
 * ## 几个实现细节
 *
 * 1. 用 <lg 隐藏平铺导航、显示汉堡按钮。断点取 lg(1024px) 而非 md：
 *    8 项以上的横向导航在 768-1024 之间仍然会挤，lg 更稳。
 *
 * 2. 菜单展开时点击任意链接自动关闭 —— 依赖 pathname 变化。
 *    同时监听 Esc 与点击遮罩，避免只能靠再点一次按钮关闭。
 *
 * 3. 展开状态在路由变化后重置。否则从菜单点进新页面，菜单还开着。
 *
 * 4. 菜单用绝对定位覆盖内容，而不是把页面顶下去 ——
 *    后者会让内容跳动，读者正在看的位置被挤走。
 */
export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 路由变化时关闭菜单
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 锁定背景滚动，避免菜单后面还能滚
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <nav className="relative z-50 border-b border-gray-800 bg-black text-white">
      <div className="flex items-center justify-between px-5 py-4 lg:px-10 lg:py-5">
        <Link
          href="/"
          className="text-xl font-bold tracking-wide whitespace-nowrap lg:text-2xl"
        >
          AI Insight Daily
        </Link>

        {/* 宽屏：平铺 */}
        <div className="hidden items-center gap-6 lg:flex xl:gap-7">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm whitespace-nowrap transition hover:text-white ${
                pathname === item.href ? "font-bold text-white" : "text-gray-400"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* 窄屏：汉堡按钮 */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "关闭菜单" : "打开菜单"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg border border-gray-700 transition hover:border-gray-500 lg:hidden"
        >
          <span
            className={`block h-0.5 w-5 bg-white transition-transform ${
              open ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-5 bg-white transition-opacity ${
              open ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`block h-0.5 w-5 bg-white transition-transform ${
              open ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* 窄屏：展开菜单 */}
      {open && (
        <>
          {/* 遮罩：点一下关闭 */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[var(--nav-h,64px)] z-40 cursor-default bg-black/60 lg:hidden"
          />

          <div
            id="mobile-nav"
            className="absolute inset-x-0 top-full z-50 max-h-[70vh] overflow-y-auto border-b border-gray-800 bg-black lg:hidden"
          >
            <div className="grid grid-cols-2 gap-1 p-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-4 py-3 text-sm transition ${
                    pathname === item.href
                      ? "bg-white font-bold text-black"
                      : "text-gray-300 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
