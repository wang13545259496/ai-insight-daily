"use client";

import { useState } from "react";

import { mvpPlans } from "@/data/mvpPlans";

interface MvpPlan {
  keyword: string;

  name: string;

  user: string;

  problem: string;

  features: string[];

  technology: string;

  plan: string[];

  business: string;
}

export default function MvpGeneratorPage() {
  const [input, setInput] = useState("");

  const [plan, setPlan] = useState<MvpPlan | null>(null);

  function generate() {
    const keyword = input.toLowerCase();

    const result = mvpPlans.find((item: MvpPlan) =>
      keyword.includes(item.keyword.toLowerCase()),
    );

    setPlan(result || mvpPlans[0]);
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
          text-4xl
          font-bold
          mb-4
          "
        >
          AI MVP Generator
        </h1>

        <p
          className="
          text-gray-400
          mb-10
          "
        >
          生成AI创业项目最小可行方案
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
            生成方案
          </button>
        </div>

        {plan && (
          <div
            className="
              border
              border-gray-800
              rounded-2xl
              p-8
              bg-neutral-950
              space-y-8
              "
          >
            <h2
              className="
                text-3xl
                font-bold
                "
            >
              {plan.name}
            </h2>

            <MvpBlock
              title="目标用户"

              content={plan.user}
            />

            <MvpBlock
              title="用户痛点"

              content={plan.problem}
            />

            <div>
              <h3
                className="
                  text-xl
                  font-bold
                  mb-2
                  "
              >
                核心功能
              </h3>

              <ul
                className="
                  text-gray-400
                  space-y-2
                  "
              >
                {plan.features.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>

            <MvpBlock
              title="技术方案"

              content={plan.technology}
            />

            <div>
              <h3
                className="
                  text-xl
                  font-bold
                  mb-2
                  "
              >
                90天执行计划
              </h3>

              <ul
                className="
                  text-gray-400
                  space-y-2
                  "
              >
                {plan.plan.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>

            <MvpBlock
              title="商业模式"

              content={plan.business}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function MvpBlock({
  title,

  content,
}: {
  title: string;

  content: string;
}) {
  return (
    <div>
      <h3
        className="
        text-xl
        font-bold
        mb-2
        "
      >
        {title}
      </h3>

      <p
        className="
        text-gray-400
        "
      >
        {content}
      </p>
    </div>
  );
}
