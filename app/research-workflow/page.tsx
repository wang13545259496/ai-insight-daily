"use client";

import { useState } from "react";

import { researchWorkflow } from "@/data/researchWorkflow";

interface ResearchResult {
  keyword: string;

  industryAnalysis: string;

  startupAdvice: string;

  productPlan: string;

  technologyPlan: string;
}

export default function ResearchWorkflowPage() {
  const [input, setInput] = useState("");

  const [result, setResult] = useState<ResearchResult | null>(null);

  function analyze() {
    const keyword = input.toLowerCase();

    const data = researchWorkflow.find((item: ResearchResult) =>
      keyword.includes(item.keyword.toLowerCase()),
    );

    setResult(data || researchWorkflow[0]);
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
        max-w-6xl
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
          AI Research Workflow
        </h1>

        <p
          className="
          text-gray-400
          text-xl
          mb-10
          "
        >
          AI虚拟研究团队协作分析系统
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
            onClick={analyze}

            className="
            border
            border-white
            rounded-xl
            px-6
            "
          >
            开始分析
          </button>
        </div>

        {result && (
          <div
            className="
              space-y-6
              "
          >
            <ResearchCard
              title="📊 AI行业分析师"

              content={result.industryAnalysis}
            />

            <ResearchCard
              title="🚀 AI创业顾问"

              content={result.startupAdvice}
            />

            <ResearchCard
              title="🧩 AI产品经理"

              content={result.productPlan}
            />

            <ResearchCard
              title="🏗️ AI技术架构师"

              content={result.technologyPlan}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function ResearchCard({
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
      <h2
        className="
        text-2xl
        font-bold
        mb-4
        "
      >
        {title}
      </h2>

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
