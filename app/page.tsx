import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const [events, news, opportunities, investments] = await Promise.all([
    prisma.newsEvent.findMany({
      orderBy: {
        heatScore: "desc",
      },

      take: 6,
    }),

    prisma.news.findMany({
      orderBy: {
        createdAt: "desc",
      },

      take: 6,
    }),

    prisma.businessOpportunity.findMany({
      orderBy: {
        createdAt: "desc",
      },

      take: 6,
    }),

    prisma.investment.findMany({
      orderBy: {
        createdAt: "desc",
      },

      take: 20,
    }),
  ]);

  // 投资观察去重
  // 同名称项目保留评分最高记录

  const investmentMap = new Map();

  investments.forEach((item) => {
    const old = investmentMap.get(item.name);

    if (!old) {
      investmentMap.set(item.name, item);
    } else {
      const oldScore =
        old.businessScore +
        old.technologyScore +
        old.marketScore +
        old.growthScore -
        old.riskScore;

      const newScore =
        item.businessScore +
        item.technologyScore +
        item.marketScore +
        item.growthScore -
        item.riskScore;

      if (newScore > oldScore) {
        investmentMap.set(item.name, item);
      }
    }
  });

  const uniqueInvestments = Array.from(investmentMap.values()).slice(0, 6);

  return (
    <div
      className="
min-h-screen
bg-black
text-white
p-10
"
    >
      <div
        className="
max-w-7xl
mx-auto
"
      >
        <section
          className="
mb-16
"
        >
          <h1
            className="
text-6xl
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
            AI趋势 · 产业机会 · 创业发现 · 投资观察
          </p>
        </section>

        {/* =====================
今日重点事件
===================== */}

        <section
          className="
border
border-gray-800
rounded-3xl
bg-gray-950
p-8
"
        >
          <div
            className="
flex
justify-between
items-center
"
          >
            <h2
              className="
text-3xl
font-bold
"
            >
              🔥 今日重点事件
            </h2>

            <Link
              href="/events"

              className="
text-gray-400
hover:text-white
"
            >
              查看全部 →
            </Link>
          </div>

          <div
            className="
mt-8
grid
md:grid-cols-3
gap-6
"
          >
            {events.map((item) => (
              <Link
                key={item.id}

                href={`/events/${item.id}`}

                className="
border
border-gray-800
rounded-2xl
bg-black
p-6
hover:border-gray-500
transition
"
              >
                <h3
                  className="
text-xl
font-bold
"
                >
                  {item.title}
                </h3>

                <p
                  className="
mt-4
text-gray-400
"
                >
                  当前热度：
                  {item.heatScore}
                </p>

                <p
                  className="
mt-4
text-gray-500
line-clamp-3
"
                >
                  {item.summary}
                </p>
              </Link>
            ))}
          </div>
        </section>
        {/* =====================
AI产业动态
===================== */}

        <section
          className="
mt-16
border
border-gray-800
rounded-3xl
bg-gray-950
p-8
"
        >
          <div
            className="
flex
justify-between
items-center
"
          >
            <h2
              className="
text-3xl
font-bold
"
            >
              📰 AI产业动态
            </h2>

            <Link
              href="/news"

              className="
text-gray-400
hover:text-white
"
            >
              更多资讯 →
            </Link>
          </div>

          <div
            className="
mt-8
grid
md:grid-cols-3
gap-6
"
          >
            {news.map((item) => (
              <Link
                key={item.id}

                href={`/news/${item.id}`}

                className="
border
border-gray-800
rounded-2xl
bg-black
p-6
hover:border-gray-500
transition
"
              >
                <h3
                  className="
text-xl
font-bold
"
                >
                  {item.title}
                </h3>

                <p
                  className="
mt-4
text-gray-400
line-clamp-3
"
                >
                  {item.summary}
                </p>

                <div
                  className="
mt-4
text-sm
text-gray-600
"
                >
                  {item.source}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* =====================
AI机会地图
===================== */}

        <section
          className="
mt-16
border
border-gray-800
rounded-3xl
bg-gray-950
p-8
"
        >
          <div
            className="
flex
justify-between
items-center
"
          >
            <h2
              className="
text-3xl
font-bold
"
            >
              🚀 AI机会地图
            </h2>

            <Link
              href="/opportunity-map"

              className="
text-gray-400
"
            >
              进入机会地图 →
            </Link>
          </div>

          <div
            className="
mt-8
grid
md:grid-cols-3
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
bg-black
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
mt-3
text-gray-400
"
                >
                  行业：
                  {item.industry}
                </p>

                <p
                  className="
mt-3
text-gray-500
"
                >
                  方向：
                  {item.direction}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* =====================
AI创业发现
===================== */}

        <section
          className="
mt-16
border
border-gray-800
rounded-3xl
bg-gray-950
p-8
"
        >
          <div
            className="
flex
justify-between
items-center
"
          >
            <h2
              className="
text-3xl
font-bold
"
            >
              🏭 AI创业发现
            </h2>

            <Link
              href="/opportunity-map"

              className="
text-gray-400
"
            >
              查看创业方向 →
            </Link>
          </div>

          <div
            className="
mt-8
grid
md:grid-cols-3
gap-6
"
          >
            {opportunities.slice(0, 3).map((item) => (
              <div
                key={item.id}

                className="
border
border-gray-800
rounded-xl
bg-black
p-6
"
              >
                <h3
                  className="
font-bold
"
                >
                  {item.opportunity}
                </h3>

                <p
                  className="
mt-3
text-gray-400
"
                >
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>
        {/* =====================
投资观察
===================== */}

        <section
          className="
mt-16
border
border-gray-800
rounded-3xl
bg-gray-950
p-8
"
        >
          <div
            className="
flex
justify-between
items-center
"
          >
            <h2
              className="
text-3xl
font-bold
"
            >
              💰 投资观察
            </h2>

            <Link
              href="/investment"

              className="
text-gray-400
hover:text-white
"
            >
              进入 →
            </Link>
          </div>

          <div
            className="
mt-8
grid
md:grid-cols-3
gap-6
"
          >
            {uniqueInvestments.map((item) => (
              <div
                key={item.id}

                className="
border
border-gray-800
rounded-xl
bg-black
p-6
"
              >
                <h3
                  className="
text-xl
font-bold
"
                >
                  {item.name}
                </h3>

                <p
                  className="
mt-3
text-gray-400
"
                >
                  {item.industry}
                </p>

                <div
                  className="
mt-4
text-gray-500
"
                >
                  商业评分：
                  {item.businessScore}
                </div>

                <div
                  className="
mt-2
text-gray-500
"
                >
                  技术评分：
                  {item.technologyScore}
                </div>

                <div
                  className="
mt-2
text-gray-500
"
                >
                  市场评分：
                  {item.marketScore}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =====================
产业全景
===================== */}

        <section
          className="
mt-16
border-t
border-gray-900
pt-10
"
        >
          <h2
            className="
text-2xl
font-bold
"
          >
            📊 AI产业全景
          </h2>

          <div
            className="
mt-6
grid
md:grid-cols-4
gap-5
"
          >
            <Stat
              title="AI资讯"

              value={news.length}
            />

            <Stat
              title="热点事件"

              value={events.length}
            />

            <Stat
              title="产业机会"

              value={opportunities.length}
            />

            <Stat
              title="投资项目"

              value={uniqueInvestments.length}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  title,

  value,
}: {
  title: string;

  value: number;
}) {
  return (
    <div
      className="
border
border-gray-800
rounded-xl
bg-gray-950
p-5
"
    >
      <div
        className="
text-gray-500
"
      >
        {title}
      </div>

      <div
        className="
mt-3
text-3xl
font-bold
"
      >
        {value}
      </div>
    </div>
  );
}
