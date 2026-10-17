"use client";

import { useState } from "react";

import Link from "next/link";

import { agentRecommend } from "@/data/agentRecommend";

interface AgentItem {
  id: number;

  name: string;

  tag: string;

  reason: string;

  keywords: string[];
}

export default function AgentRecommendPage() {
  const [input, setInput] = useState("");

  const [result, setResult] = useState<AgentItem[]>([]);

  function recommend() {
    const keyword = input.toLowerCase().trim();

    const matched = agentRecommend.filter((agent: AgentItem) =>
      agent.keywords.some((word: string) => {
        const key = word.toLowerCase();

        return keyword.includes(key) || key.includes(keyword);
      }),
    );

    setResult(matched.length > 0 ? matched : agentRecommend.slice(0, 3));
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
          mb-5
          "
        >
          AI Agent智能推荐中心
        </h1>

        <p
          className="
          text-gray-400
          text-xl
          mb-10
          "
        >
          根据你的需求，发现最适合的AI智能体
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

            placeholder="例如：企业客服、自动化办公、代码开发"

            className="
            flex-1
            bg-neutral-900
            border
            border-gray-700
            rounded-xl
            p-4
            outline-none
            "
          />

          <button
            onClick={recommend}

            className="
            px-6
            rounded-xl
            border
            border-white
            "
          >
            开始推荐
          </button>
        </div>

        <div
          className="
          space-y-6
          "
        >
          {result.length > 0 ? (
            result.map((agent) => (
              <Link
                key={agent.id}

                href={`/agent-market/${agent.id}`}

                className="
              block
              "
              >
                <div
                  className="
                border
                border-gray-800
                rounded-2xl
                p-6
                bg-neutral-950
                hover:border-gray-500
                transition
                "
                >
                  <div
                    className="
                  text-gray-400
                  mb-3
                  "
                  >
                    {agent.tag}
                  </div>

                  <h2
                    className="
                  text-3xl
                  font-bold
                  mb-4
                  "
                  >
                    {agent.name}
                  </h2>

                  <p
                    className="
                  text-gray-400
                  leading-8
                  "
                  >
                    {agent.reason}
                  </p>

                  <div
                    className="
                  mt-5
                  text-sm
                  text-gray-400
                  "
                  >
                    查看Agent详情 →
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p
              className="
            text-gray-400
            text-xl
            "
            >
              请输入需求开始推荐
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
