import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AgentPage() {
  const [
    newsCount,
    eventCount,
    agentNews,
    agentEvents,
  ] = await Promise.all([
    prisma.news.count({
      where: {
        dataStatus: "active",
      },
    }),

    prisma.newsEvent.count({
      where: {
        status: "active",
      },
    }),

    prisma.news.findMany({
      where: {
        OR: [
          { title: { contains: "Agent" } },
          { title: { contains: "智能体" } },
          { title: { contains: "Copilot" } },
          { title: { contains: "助手" } },
          { title: { contains: "自动化" } },
          { title: { contains: "工作流" } },
          { summary: { contains: "Agent" } },
          { summary: { contains: "智能体" } },
          { summary: { contains: "助手" } },
          { summary: { contains: "自动化" } },
        ],
        dataStatus: "active",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        title: true,
        summary: true,
        createdAt: true,
      },
    }),

    prisma.newsEvent.findMany({
      where: {
        status: "active",
        OR: [
          { title: { contains: "Agent" } },
          { title: { contains: "智能体" } },
        ],
      },
      orderBy: {
        heatScore: "desc",
      },
      take: 8,
      select: {
        id: true,
        title: true,
        heatScore: true,
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">

        <section className="border border-gray-800 rounded-3xl bg-gray-950 p-8">

          <h1 className="text-4xl font-bold">
            AI Agent生态中心
          </h1>

          <p className="mt-4 text-gray-400">
            AI智能体应用 · 企业服务 · 商业生态分析
          </p>

          <div className="mt-8 grid md:grid-cols-3 gap-5">

            <MetricCard
              title="AI资讯"
              value={String(newsCount)}
            />

            <MetricCard
              title="产业事件"
              value={String(eventCount)}
            />

            <MetricCard
              title="生态状态"
              value="持续演进"
            />

          </div>

        </section>


        <section className="mt-6 grid md:grid-cols-2 gap-6">


          <div className="border border-gray-800 rounded-3xl bg-gray-950 p-6">

            <h2 className="text-2xl font-bold">
              📰 Agent最新资讯
            </h2>

            <div className="mt-5 space-y-4">

              {agentNews.map(item=>(
                <Link
                  key={item.id}
                  href={`/news/${item.id}`}
                  className="block border-b border-gray-800 pb-3 hover:text-gray-300"
                >
                  {item.title}
                </Link>
              ))}

            </div>

            <Link
              href="/news"
              className="block mt-6 text-gray-400"
            >
              查看全部资讯 →
            </Link>

          </div>



          <div className="border border-gray-800 rounded-3xl bg-gray-950 p-6">

            <h2 className="text-2xl font-bold">
              🔥 Agent事件观察
            </h2>

            <div className="mt-5 space-y-4">

              {agentEvents.map(item=>(
                <Link
                  key={item.id}
                  href={`/events/${item.id}`}
                  className="block border-b border-gray-800 pb-3 hover:text-gray-300"
                >
                  {item.title}
                  <span className="ml-3 text-gray-500">
                    {Math.round(item.heatScore)}
                  </span>
                </Link>
              ))}

            </div>

            <Link
              href="/events"
              className="block mt-6 text-gray-400"
            >
              查看全部事件 →
            </Link>

          </div>


        </section>


        <section className="mt-6 grid md:grid-cols-3 gap-5">

          <Link
            href="/opportunity-map"
            className="border border-gray-800 rounded-3xl bg-gray-950 p-6 hover:border-gray-500"
          >
            💰 Agent商业机会
            <p className="mt-3 text-gray-400">
              企业服务、行业解决方案、智能应用平台
            </p>
          </Link>


          <Link
            href="/investment"
            className="border border-gray-800 rounded-3xl bg-gray-950 p-6 hover:border-gray-500"
          >
            📈 Agent投资观察
            <p className="mt-3 text-gray-400">
              AI创业公司与商业模式分析
            </p>
          </Link>


          <Link
            href="/models"
            className="border border-gray-800 rounded-3xl bg-gray-950 p-6 hover:border-gray-500"
          >
            🤖 模型生态
            <p className="mt-3 text-gray-400">
              基础模型与Agent能力底座
            </p>
          </Link>

        </section>

      </div>
    </div>
  );
}


function MetricCard({
  title,
  value,
}: {
  title:string;
  value:string;
}) {
  return (
    <div className="border border-gray-800 rounded-2xl p-5">
      <div className="text-gray-400">
        {title}
      </div>
      <div className="mt-3 text-3xl font-bold">
        {value}
      </div>
    </div>
  );
}
