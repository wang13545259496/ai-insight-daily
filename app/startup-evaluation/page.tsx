"use client";

import { useState } from "react";

import { startupEvaluation } from "@/data/startupEvaluation";

interface EvaluationItem {
  industry: string;

  market: number;

  aiFit: number;

  technology: number;

  business: number;

  difficulty: number;
}

export default function StartupEvaluationPage() {
  const [input, setInput] = useState("");

  const [result, setResult] = useState<EvaluationItem | null>(null);

  function evaluate() {
    const keyword = input.toLowerCase();

    const item = startupEvaluation.find((data: EvaluationItem) =>
      keyword.includes(data.industry.toLowerCase()),
    );

    setResult(item || startupEvaluation[0]);
  }

  const score = result
    ? (result.market +
        result.aiFit +
        result.technology +
        result.business +
        result.difficulty) /
      5
    : null;

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
          text-4xl
          font-bold
          mb-4
          "
        >
          AI创业项目评估
        </h1>

        <p
          className="
          text-gray-400
          mb-10
          "
        >
          AI创业项目综合价值评估
        </p>

        <div
          className="
          flex
          gap-4
          mb-10
          "
        >
          <input
            value={input}

            onChange={(e) => setInput(e.target.value)}

            placeholder="输入创业方向，例如：物业、电商、教育"

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
            onClick={evaluate}

            className="
            border
            border-white
            rounded-xl
            px-6
            "
          >
            开始评估
          </button>
        </div>

        {result && (
          <div
            className="
              border
              border-gray-800
              rounded-2xl
              p-8
              bg-neutral-950
              "
          >
            <h2
              className="
                text-3xl
                font-bold
                mb-8
                "
            >
              {result.industry}
            </h2>

            <div
              className="
                text-5xl
                font-bold
                mb-10
                "
            >
              {score?.toFixed(1)}
            </div>

            <div
              className="
                grid
                md:grid-cols-5
                gap-6
                "
            >
              <ScoreCard
                title="市场需求"

                value={result.market}
              />

              <ScoreCard
                title="AI适配"

                value={result.aiFit}
              />

              <ScoreCard
                title="技术可行"

                value={result.technology}
              />

              <ScoreCard
                title="商业价值"

                value={result.business}
              />

              <ScoreCard
                title="创业难度"

                value={result.difficulty}
              />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function ScoreCard({
  title,

  value,
}: {
  title: string;

  value: number;
}) {
  return (
    <div>
      <p className="text-gray-400">{title}</p>

      <p className="text-2xl">{value}</p>
    </div>
  );
}
