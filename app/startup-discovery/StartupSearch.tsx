"use client";

import { useState } from "react";

export default function StartupSearch({ projects }: { projects: any[] }) {
  const [keyword, setKeyword] = useState("");

  const result = projects.filter((item) => {
    if (!keyword) {
      return true;
    }

    const text = (
      item.name +
      item.category +
      item.description +
      item.trend
    ).toLowerCase();

    return text.includes(keyword.toLowerCase());
  });

  return (
    <div>
      <div
        className="
        flex
        gap-4
        mb-10
        "
      >
        <input
          value={keyword}

          onChange={(e) => setKeyword(e.target.value)}

          placeholder="
          输入产业方向，例如：智能体、大模型、教育
          "

          className="
          flex-1
          bg-neutral-900
          border
          border-gray-700
          rounded-xl
          p-4
          "
        />
      </div>

      <div
        className="
        grid
        md:grid-cols-2
        gap-6
        "
      >
        {result.map((item) => (
          <div
            key={item.id}

            className="
            border
            border-gray-800
            rounded-2xl
            p-8
            bg-neutral-950
            "
          >
            <div
              className="
              text-gray-500
              mb-3
              "
            >
              产业热度：
              {item.score}
            </div>

            <h2
              className="
              text-2xl
              font-bold
              mb-3
              "
            >
              {item.name}
            </h2>

            <p
              className="
              text-gray-400
              "
            >
              分类：
              {item.category}
            </p>

            <p
              className="
              text-gray-400
              mt-2
              "
            >
              趋势：
              {item.trend}
            </p>

            <p
              className="
              text-gray-300
              mt-5
              "
            >
              {item.description}
            </p>

            <div
              className="
              mt-6
              border-t
              border-gray-800
              pt-5
              "
            >
              <h3
                className="
                font-bold
                mb-4
                "
              >
                商业机会
              </h3>

              {item.opportunities.length === 0 ? (
                <p className="text-gray-500">暂无匹配机会</p>
              ) : (
                item.opportunities.map((op: any) => (
                  <div
                    key={op.id}

                    className="
                    mb-4
                    "
                  >
                    <div
                      className="
                      font-bold
                      "
                    >
                      🚀 {op.opportunity}
                    </div>

                    <div
                      className="
                      text-gray-400
                      text-sm
                      "
                    >
                      行业：
                      {op.industry}
                    </div>

                    <div
                      className="
                      text-gray-400
                      text-sm
                      "
                    >
                      方向：
                      {op.direction}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
