"use client";

import { useState } from "react";

import { startupReports } from "@/data/startupReports";

interface StartupReport {
  keyword: string;

  title: string;

  industry: string;

  summary: string;

  market: string;

  solution: string;

  model: string;

  agent: string;

  mvp: string;

  business: string;

  score: number;
}

export default function StartupReportPage() {
  const [input, setInput] = useState("");

  const [report, setReport] = useState<StartupReport | null>(null);

  function generate() {
    const keyword = input.toLowerCase();

    const result = startupReports.find((item: StartupReport) =>
      keyword.includes(item.keyword.toLowerCase()),
    );

    setReport(result || startupReports[0]);
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
          AI创业研究报告
        </h1>

        <p
          className="
          text-gray-400
          mb-10
          "
        >
          生成AI创业研究分析报告
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
            生成报告
          </button>
        </div>

        {report && (
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
              {report.title}
            </h2>

            <ReportBlock
              title="行业方向"

              content={report.industry}
            />

            <ReportBlock
              title="项目概述"

              content={report.summary}
            />

            <ReportBlock
              title="市场机会"

              content={report.market}
            />

            <ReportBlock
              title="AI解决方案"

              content={report.solution}
            />

            <div
              className="
                grid
                md:grid-cols-2
                gap-6
                "
            >
              <ReportBlock
                title="推荐模型"

                content={report.model}
              />

              <ReportBlock
                title="推荐Agent"

                content={report.agent}
              />
            </div>

            <ReportBlock
              title="MVP启动方案"

              content={report.mvp}
            />

            <ReportBlock
              title="商业模式"

              content={report.business}
            />

            <div>
              <h3
                className="
                  text-xl
                  font-bold
                  mb-2
                  "
              >
                创业评分
              </h3>

              <p
                className="
                  text-4xl
                  font-bold
                  "
              >
                {report.score}
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function ReportBlock({
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
        leading-8
        "
      >
        {content}
      </p>
    </div>
  );
}
