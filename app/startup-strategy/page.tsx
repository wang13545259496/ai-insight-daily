"use client";

import { useState } from "react";

import { startupStrategy } from "@/data/startupStrategy";

interface StrategyReport {
  keyword: string;

  title: string;

  vision: string;

  market: string;

  product: string;

  technology: string;

  mvp: string;

  business: string;

  score: number;
}

export default function StartupStrategyPage() {
  const [input, setInput] = useState("");

  const [report, setReport] = useState<StrategyReport | null>(null);

  function generate() {
    const keyword = input.toLowerCase();

    const result = startupStrategy.find((item: StrategyReport) =>
      keyword.includes(item.keyword.toLowerCase()),
    );

    setReport(result || startupStrategy[0]);
  }

  return (
    <main
      className="
      min-h-screen
      bg-black
      text-white
      p-10
      "
    >
      <section
        className="
        max-w-5xl
        mx-auto
        "
      >
        <h1
          className="
          text-5xl
          font-bold
          mb-4
          "
        >
          AI创业战略
        </h1>

        <p
          className="
          text-gray-400
          text-xl
          mb-10
          "
        >
          AI商业智能体战略报告中心
        </p>

        <div
          className="
          flex
          gap-4
          mb-12
          "
        >
          <input
            value={input}

            onChange={(e) => setInput(e.target.value)}

            placeholder="输入创业方向，例如：物业、电商"

            className="
            flex-1
            bg-neutral-900
            border
            border-gray-700
            rounded-xl
            p-4
            "
          />

          <button
            onClick={generate}

            className="
            border
            border-white
            rounded-xl
            px-6
            "
          >
            生成战略报告
          </button>
        </div>

        {report && (
          <div
            className="
              space-y-6
              "
          >
            <h2
              className="
                text-4xl
                font-bold
                mb-8
                "
            >
              {report.title}
            </h2>

            <StrategyBlock
              title="战略愿景"

              content={report.vision}
            />

            <StrategyBlock
              title="市场机会"

              content={report.market}
            />

            <StrategyBlock
              title="产品体系"

              content={report.product}
            />

            <StrategyBlock
              title="技术架构"

              content={report.technology}
            />

            <StrategyBlock
              title="MVP计划"

              content={report.mvp}
            />

            <StrategyBlock
              title="商业模式"

              content={report.business}
            />

            <div
              className="
                text-center
                border
                border-gray-800
                rounded-2xl
                p-8
                bg-neutral-950
                "
            >
              <h3 className="text-xl mb-3">战略评分</h3>

              <div
                className="
                  text-6xl
                  font-bold
                  "
              >
                {report.score}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function StrategyBlock({
  title,

  content,
}: {
  title: string;

  content: string;
}) {
  return (
    <div
      className="
      border
      border-gray-800
      rounded-2xl
      p-8
      bg-neutral-950
      "
    >
      <h3
        className="
        text-2xl
        font-bold
        mb-3
        "
      >
        {title}
      </h3>

      <p
        className="
        text-gray-400
        leading-8
        "
      >
        {content}
      </p>
    </div>
  );
}
