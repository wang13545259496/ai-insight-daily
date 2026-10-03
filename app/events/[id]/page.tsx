import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const event = await prisma.newsEvent.findUnique({
    where: {
      id: Number(id),
    },

    include: {
      news: {
        orderBy: {
          createdAt: "desc",
        },

        take: 20,

        include: {
          sourceRef: true,
        },
      },
    },
  });

  if (!event) {
    return (
      <div
        className="
min-h-screen
bg-black
text-white
p-8
"
      >
        <h1
          className="
text-3xl
font-bold
"
        >
          事件不存在
        </h1>
      </div>
    );
  }

  const newsCount = event.news.length;

  const sourceCount = new Set(event.news.map((item) => item.source)).size;

  const latestTime = event.news[0]?.createdAt || event.createdAt;

  return (
    <div
      className="
min-h-screen
bg-black
text-white
p-8
"
    >
      <div
        className="
max-w-7xl
mx-auto
"
      >
        {/* =====================
事件顶部驾驶舱
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
gap-8
"
          >
            <div>
              <h1
                className="
text-4xl
font-bold
leading-tight
"
              >
                🔥 {event.title}
              </h1>

              <p
                className="
mt-5
text-gray-400
leading-7
"
              >
                {event.summary}
              </p>
            </div>

            <div
              className="
min-w-[260px]
border
border-gray-800
rounded-2xl
p-5
"
            >
              <div
                className="
text-gray-500
text-sm
"
              >
                事件指标
              </div>

              <div
                className="
mt-4
space-y-3
text-gray-300
"
              >
                <p>
                  🔥 热度：
                  {event.heatScore}
                </p>

                <p>
                  📂 分类：
                  {event.category}
                </p>

                <p>
                  📰 新闻：
                  {newsCount} 篇
                </p>

                <p>
                  🌐 来源：
                  {sourceCount} 个
                </p>
              </div>
            </div>
          </div>
        </section>
        {/* =====================
事件商业分析
===================== */}

        <div
          className="
mt-6
grid
md:grid-cols-3
gap-5
"
        >
          <AnalysisCard
            title="📌 事件背景"

            text={`
${event.category}

该事件由多个信息来源持续跟踪，
系统根据新闻聚合和事件关联关系生成分析。
`}
          />

          <AnalysisCard
            title="🏭 产业影响"

            text={`
AI产品生态

企业数字化升级

AI商业模式探索
`}
          />

          <AnalysisCard
            title="💰 商业机会"

            text={`
AI应用工具

企业智能助手

AI服务平台

行业解决方案
`}
          />
        </div>

        {/* =====================
风险关注
===================== */}

        <section
          className="
mt-5
border
border-gray-800
rounded-2xl
bg-gray-950
p-6
"
        >
          <h2
            className="
text-xl
font-bold
"
          >
            ⚠ 风险关注
          </h2>

          <div
            className="
mt-4
grid
md:grid-cols-3
gap-4
"
          >
            <SmallCard text="技术成熟度" />

            <SmallCard text="数据安全" />

            <SmallCard text="商业落地成本" />
          </div>
        </section>

        {/* =====================
事件发展时间线
===================== */}

        <section
          className="
mt-6
border
border-gray-800
rounded-2xl
bg-gray-950
p-6
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
text-xl
font-bold
"
            >
              📰 新闻发展时间线
            </h2>

            <div
              className="
text-sm
text-gray-500
"
            >
              最新动态：
              {new Date(latestTime).toLocaleDateString("zh-CN")}
            </div>
          </div>

          <div
            className="
mt-5
space-y-3
"
          >
            {event.news.map((item) => (
              <Link
                key={item.id}

                href={`/news/${item.id}`}

                className="
block
border
border-gray-800
rounded-xl
p-4
hover:border-gray-600
"
              >
                <div
                  className="
flex
justify-between
gap-4
"
                >
                  <h3
                    className="
font-bold
text-sm
"
                  >
                    {item.title}
                  </h3>

                  <span
                    className="
text-xs
text-gray-500
"
                  >
                    {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>

                <div
                  className="
mt-2
text-sm
text-gray-500
"
                >
                  来源：
                  {item.source}
                </div>
              </Link>
            ))}
          </div>
        </section>
        {/* =====================
来源与事件信息
===================== */}

        <section
          className="
mt-6
border
border-gray-800
rounded-2xl
bg-gray-950
p-6
"
        >
          <h2
            className="
text-xl
font-bold
"
          >
            🌐 来源分析
          </h2>

          <div
            className="
mt-5
grid
md:grid-cols-3
gap-4
"
          >
            <div
              className="
border
border-gray-800
rounded-xl
p-4
"
            >
              <div
                className="
text-gray-500
text-sm
"
              >
                相关新闻数量
              </div>

              <div
                className="
mt-2
text-2xl
font-bold
"
              >
                {newsCount}
              </div>
            </div>

            <div
              className="
border
border-gray-800
rounded-xl
p-4
"
            >
              <div
                className="
text-gray-500
text-sm
"
              >
                信息来源
              </div>

              <div
                className="
mt-2
text-2xl
font-bold
"
              >
                {sourceCount}
              </div>
            </div>

            <div
              className="
border
border-gray-800
rounded-xl
p-4
"
            >
              <div
                className="
text-gray-500
text-sm
"
              >
                事件趋势
              </div>

              <div
                className="
mt-2
text-xl
font-bold
"
              >
                持续关注
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AnalysisCard({
  title,

  text,
}: {
  title: string;

  text: string;
}) {
  return (
    <div
      className="
border
border-gray-800
rounded-2xl
bg-gray-950
p-5
"
    >
      <h3
        className="
font-bold
text-lg
"
      >
        {title}
      </h3>

      <p
        className="
mt-3
text-sm
text-gray-500
leading-5
whitespace-pre-line
"
      >
        {text}
      </p>
    </div>
  );
}

function SmallCard({ text }: { text: string }) {
  return (
    <div
      className="
border
border-gray-800
rounded-xl
bg-black
p-4
text-gray-300
text-sm
"
    >
      {text}
    </div>
  );
}
