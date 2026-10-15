"use client";

import { useState } from "react";

/**
 * 产业链总览的层级列表（紧凑式 + 可展开）。
 *
 * 为什么需要独立组件：首页 app/page.tsx 是服务端组件，
 * 而「展开查看全部」需要交互状态，因此抽成客户端组件。
 *
 * 默认每层只显示 1 条代表新闻（保持页面紧凑，避免两块连续长列表）；
 * 点击「查看全部 N 条」后展开该层全部新闻，链接指向 /news/[id]。
 */

export interface LayerItem {
  id: number;
  title: string;
}

export interface LayerData {
  name: string;
  description: string;
  count: number;
  percent: number;
  /** 代表新闻（用于折叠态显示） */
  samples: Array<{ id: number; title: string; source: string }>;
  /** 该层全部新闻（展开态使用） */
  all: LayerItem[];
}

/** 折叠态显示的代表新闻条数 */
const COLLAPSED_SAMPLES = 1;

/** 展开态最多显示条数（避免超长列表） */
const EXPANDED_LIMIT = 20;

export default function IndustryLayerList({ layers }: { layers: LayerData[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="border border-gray-200 bg-white">
      {layers.map((layer) => {
        const isOpen = expanded[layer.name] === true;
        const items = isOpen ? layer.all.slice(0, EXPANDED_LIMIT) : layer.samples.slice(0, COLLAPSED_SAMPLES);
        const hidden = Math.max(0, layer.count - items.length);

        return (
          <div
            key={layer.name}
            className="border-b border-gray-100 px-5 py-4 last:border-b-0"
          >
            <div className="flex items-center gap-4">
              <div className="w-24 shrink-0">
                <div className="text-sm font-bold">{layer.name}</div>
                <div className="text-xs text-gray-400 tabular-nums">
                  {layer.count} 条 · {layer.percent}%
                </div>
              </div>

              <div className="h-1.5 min-w-0 flex-1 bg-gray-100">
                <div
                  className="h-1.5 bg-black"
                  style={{ width: `${Math.min(100, layer.percent)}%` }}
                />
              </div>

              <div className="hidden w-56 shrink-0 text-right text-xs text-gray-400 lg:block">
                {layer.description}
              </div>
            </div>

            {items.length > 0 && (
              <ul className="mt-2 space-y-1 lg:pl-28">
                {items.map((item) => (
                  <li key={item.id} className="flex items-baseline gap-2 text-sm">
                    <a
                      href={`/news/${item.id}`}
                      className="line-clamp-1 min-w-0 hover:underline"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {layer.count > COLLAPSED_SAMPLES && (
              <div className="mt-2 lg:pl-28">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [layer.name]: !isOpen }))
                  }
                  className="text-xs font-bold text-gray-500 underline decoration-gray-300 underline-offset-4 hover:text-black hover:decoration-black"
                >
                  {isOpen
                    ? "收起"
                    : layer.count > EXPANDED_LIMIT
                      ? `查看全部 ${layer.count} 条（显示前 ${EXPANDED_LIMIT} 条）`
                      : `查看全部 ${layer.count} 条`}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
