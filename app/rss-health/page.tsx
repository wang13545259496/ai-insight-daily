"use client";

import { useEffect, useState } from "react";

interface RssSourceHealth {
  id: number;

  name: string;

  rssUrl: string | null;

  rssStatus: string;

  rssScore: number;

  rssSuccessCount: number;

  rssFailCount: number;

  lastCheckTime: string | Date | null;

  lastResponseTime: number | null;

  rssPausedAt: string | Date | null;

  lastError: string | null;
}

interface RssSummary {
  total: number;

  healthy: number;

  warning: number;

  failed: number;

  averageScore: number;
}

interface RssHealthReport {
  success: boolean;

  ranking: RssSourceHealth[];

  summary: RssSummary;

  updatedAt: string;
}

export default function RSSHealthPage() {
  const [data, setData] = useState<RssHealthReport | null>(null);

  useEffect(() => {
    fetch("/api/rss-health")
      .then((res) => res.json())

      .then((result: RssHealthReport) => {
        setData(result);
      });
  }, []);

  if (!data) {
    return (
      <main
        className="
        min-h-screen
        bg-black
        text-white
        flex
        items-center
        justify-center
        "
      >
        RSS健康数据加载中...
      </main>
    );
  }

  return (
    <main
      className="
      min-h-screen
      bg-black
      text-white
      px-10
      py-12
      "
    >
      <h1
        className="
        text-4xl
        font-bold
        mb-10
        "
      >
        RSS健康评分中心
      </h1>

      <section
        className="
        grid
        grid-cols-5
        gap-5
        mb-12
        "
      >
        <Card
          title="RSS来源"

          value={data.summary.total}
        />

        <Card
          title="健康"

          value={data.summary.healthy}
        />

        <Card
          title="警告"

          value={data.summary.warning}
        />

        <Card
          title="失败"

          value={data.summary.failed}
        />

        <Card
          title="平均评分"

          value={data.summary.averageScore}
        />
      </section>

      <section>
        <h2
          className="
          text-2xl
          font-bold
          mb-6
          "
        >
          RSS健康排行榜
        </h2>

        <div
          className="
          space-y-4
          "
        >
          {data.ranking.map((item, index) => (
            <div
              key={item.id}

              className="
                bg-zinc-900
                border
                border-zinc-800
                rounded-xl
                p-6
                flex
                justify-between
                "
            >
              <div>
                <h3
                  className="
                    text-xl
                    font-bold
                    "
                >
                  {index + 1}.{item.name}
                </h3>

                <p
                  className="
                    text-gray-400
                    mt-2
                    "
                >
                  {item.rssUrl}
                </p>
              </div>

              <div
                className="
                  text-right
                  "
              >
                <p>
                  状态：
                  {item.rssStatus}
                </p>

                <p>
                  健康评分：
                  <span
                    className="
                      font-bold
                      "
                  >
                    {item.rssScore}
                  </span>
                </p>

                <p>
                  响应：
                  {item.lastResponseTime ?? 0}
                  ms
                </p>

                <p>
                  失败次数：
                  {item.rssFailCount}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Card({
  title,

  value,
}: {
  title: string;

  value: number;
}) {
  return (
    <div
      className="
      bg-zinc-900
      border
      border-zinc-800
      rounded-xl
      p-5
      "
    >
      <p
        className="
        text-gray-400
        "
      >
        {title}
      </p>

      <p
        className="
        text-3xl
        font-bold
        mt-3
        "
      >
        {value}
      </p>
    </div>
  );
}
