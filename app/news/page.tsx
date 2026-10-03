import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function NewsPage() {
  const news = await prisma.news.findMany({
    orderBy: {
      createdAt: "desc",
    },

    take: 30,
  });

  const categories = Array.from(new Set(news.map((item) => item.category)));

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
        {/* 页面标题 */}

        <section>
          <h1
            className="
text-5xl
font-bold
"
          >
            AI资讯中心
          </h1>

          <p
            className="
mt-5
text-xl
text-gray-400
"
          >
            实时追踪全球AI产业动态、技术进展与企业变化
          </p>

          <p
            className="
mt-3
text-gray-500
"
          >
            News Intelligence Center
          </p>
        </section>

        {/* 数据概览 */}

        <section
          className="
mt-12
grid
grid-cols-1
md:grid-cols-3
gap-6
"
        >
          <StatCard
            title="资讯数量"

            value={news.length}
          />

          <StatCard
            title="覆盖分类"

            value={categories.length}
          />

          <StatCard
            title="最新更新"

            value="实时"
          />
        </section>

        {/* 分类 */}

        <section
          className="
mt-12
"
        >
          <h2
            className="
text-3xl
font-bold
"
          >
            AI领域分类
          </h2>

          <div
            className="
mt-6
flex
flex-wrap
gap-3
"
          >
            {categories.map((category) => (
              <div
                key={category}

                className="
border
border-gray-800
rounded-full
px-5
py-2
bg-gray-950
text-gray-300
"
              >
                {category}
              </div>
            ))}
          </div>
        </section>

        {/* 新闻列表 */}

        <section
          className="
mt-16
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
              最新AI动态
            </h2>

            <p
              className="
text-gray-500
"
            >
              共 {news.length} 条
            </p>
          </div>

          <div
            className="
mt-8
grid
grid-cols-1
md:grid-cols-2
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
p-7
bg-gray-950
hover:border-gray-500
transition
"
              >
                <div
                  className="
flex
justify-between
gap-4
"
                >
                  <span
                    className="
text-sm
text-gray-500
"
                  >
                    {item.category}
                  </span>

                  <span
                    className="
text-sm
text-gray-600
"
                  >
                    {item.source}
                  </span>
                </div>

                <h3
                  className="
mt-5
text-xl
font-bold
leading-8
"
                >
                  {item.title}
                </h3>

                <p
                  className="
mt-4
text-gray-400
leading-7
line-clamp-3
"
                >
                  {item.summary}
                </p>

                <div
                  className="
mt-6
text-sm
text-gray-600
"
                >
                  {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  title,

  value,
}: {
  title: string;

  value: string | number;
}) {
  return (
    <div
      className="
border
border-gray-800
rounded-2xl
bg-gray-950
p-7
"
    >
      <p
        className="
text-gray-500
"
      >
        {title}
      </p>

      <p
        className="
mt-4
text-4xl
font-bold
"
      >
        {value}
      </p>
    </div>
  );
}
