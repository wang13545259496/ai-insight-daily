import Link from "next/link";
import NewsTitle from "@/components/NewsTitle";

import { prisma } from "@/lib/prisma";

export default async function DailyPage() {
  const reports = await prisma.dailyReport.findMany({
    orderBy: {
      createdAt: "desc",
    },

    take: 20,
  });

  const hotEvents = await prisma.newsEvent.findMany({
    orderBy: {
      heatScore: "desc",
    },

    take: 5,

    include: {
      news: {
        select: {
          id: true,
        },
      },
    },
  });

  const opportunities = await prisma.businessOpportunity.findMany({
    take: 4,

    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main
      className="
      min-h-screen
      bg-black
      text-white
      "
    >
      <section
        className="
        max-w-6xl
        mx-auto
        px-8
        py-16
        "
      >
        <h1
          className="
          text-5xl
          font-bold
          "
        >
          AI Insight Daily
        </h1>

        <p
          className="
          mt-5
          text-xl
          text-gray-400
          "
        >
          每日AI行业智能分析报告
        </p>

        <p
          className="
          mt-3
          text-gray-400
          "
        >
          自动追踪全球AI技术、企业动态与产业趋势
        </p>
      </section>

      {/* 今日重点事件 */}

      <section
        className="
        max-w-6xl
        mx-auto
        px-8
        "
      >
        <h2
          className="
          text-3xl
          font-bold
          mb-8
          "
        >
          🔥 今日AI重点事件
        </h2>

        <div
          className="
          space-y-8
          "
        >
          {hotEvents.map((event, index) => (
            <Link
              href={`/events/${event.id}`}

              key={event.id}
            >
              <div
                className="
              border
              border-gray-800
              rounded-2xl
              p-8
              hover:border-white
              transition
              "
              >
                <div
                  className="
                text-gray-400
                mb-3
                "
                >
                  TOP {index + 1}
                </div>

                <h3
                  className="
                text-2xl
                font-bold
                "
                >
                  <NewsTitle title={event.title} titleZh={event.titleZh} />
                </h3>

                <div
                  className="
                grid
                md:grid-cols-4
                gap-6
                mt-8
                "
                >
                  <div>
                    <p className="text-gray-400">行业领域</p>

                    <p className="mt-2">{event.category}</p>
                  </div>

                  <div>
                    <p className="text-gray-400">当前热度</p>

                    <p className="mt-2">{event.heatScore}</p>
                  </div>

                  <div>
                    <p className="text-gray-400">相关新闻</p>

                    <p className="mt-2">{event.news.length} 篇</p>
                  </div>

                  <div>
                    <p className="text-gray-400">趋势</p>

                    <p
                      className="
                    mt-2
                    text-green-400
                    "
                    >
                      {event.trendStatus}
                    </p>
                  </div>
                </div>

                <div
                  className="
                mt-8
                border-t
                border-gray-800
                pt-6
                "
                >
                  <h4
                    className="
                  font-bold
                  text-lg
                  "
                  >
                    事件背景
                  </h4>

                  <p
                    className="
                  mt-3
                  text-gray-400
                  leading-7
                  "
                  >
                    {event.summary}
                  </p>
                </div>

                <div
                  className="
                mt-6
                "
                >
                  <h4
                    className="
                  font-bold
                  text-lg
                  "
                  >
                    趋势分析
                  </h4>

                  <p
                    className="
                  mt-3
                  text-gray-400
                  leading-7
                  "
                  >
                    {event.trendSummary || "系统持续跟踪该事件发展。"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 商业机会 */}

      <section
        className="
        max-w-6xl
        mx-auto
        px-8
        py-20
        "
      >
        <h2
          className="
          text-3xl
          font-bold
          mb-8
          "
        >
          🚀 AI商业机会观察
        </h2>

        <div
          className="
          grid
          md:grid-cols-2
          gap-6
          "
        >
          {opportunities.map((item) => (
            <div
              key={item.id}

              className="
              border
              border-gray-800
              rounded-xl
              p-6
              "
            >
              <h3
                className="
                text-xl
                font-bold
                "
              >
                {item.opportunity}
              </h3>

              <p
                className="
                mt-4
                text-gray-400
                "
              >
                {item.direction}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 历史日报 */}

      <section
        className="
        max-w-6xl
        mx-auto
        px-8
        pb-20
        "
      >
        <h2
          className="
          text-3xl
          font-bold
          mb-8
          "
        >
          📚 历史AI日报
        </h2>

        <div
          className="
          grid
          md:grid-cols-2
          gap-6
          "
        >
          {reports.map((report) => (
            <Link
              href={`/daily/${report.id}`}

              key={report.id}
            >
              <div
                className="
                border
                border-gray-800
                rounded-xl
                p-6
                hover:border-white
                transition
                "
              >
                <h3
                  className="
                  text-xl
                  font-bold
                  "
                >
                  {report.title}
                </h3>

                <p
                  className="
                  mt-3
                  text-gray-400
                  "
                >
                  {report.date}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
