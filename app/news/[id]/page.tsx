import { prisma } from "@/lib/prisma";

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const newsId = Number(id);

  const news = await prisma.news.findUnique({
    where: {
      id: newsId,
    },
  });

  if (!news) {
    return (
      <div
        className="
min-h-screen
bg-black
text-white
p-10
"
      >
        <h1>新闻不存在</h1>
      </div>
    );
  }

  const sections = parseNewsContent(news.content);

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
        <section
          className="
border
border-gray-800
rounded-3xl
bg-gray-950
p-8
"
        >
          <h1
            className="
text-4xl
font-bold
"
          >
            {news.title}
          </h1>
          <div
            className="
mt-5
flex
items-center
justify-between
"
          >
            <div
              className="
text-sm
text-gray-500
"
            >
              来源：
              {news.source}
            </div>

            {news.sourceUrl && (
              <a
                href={news.sourceUrl}

                target="_blank"

                rel="noopener noreferrer"

                className="
text-sm
text-gray-300
border
border-gray-700
rounded-lg
px-4
py-2
hover:bg-gray-900
"
              >
                🔗 查看原始新闻
              </a>
            )}
          </div>
          <div
            className="
mt-4
text-sm
text-gray-500
flex
gap-5
"
          >
            <span>{news.category}</span>

            <span>{news.source}</span>
          </div>
        </section>
        <section
          className="
mt-6
grid
lg:grid-cols-4
gap-4
"
        >
          {/* 核心内容 */}

          <div
            className="
lg:col-span-4
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
              📌 核心内容
            </h2>

            <p
              className="
mt-4
text-sm
text-gray-300
leading-6
"
            >
              {sections.core || news.summary || "暂无核心内容"}
            </p>
          </div>

          {/* 产业影响 */}

          <AnalysisPanel
            title="产业影响"

            items={sections.impact}
          />

          {/* 商业机会 */}

          <AnalysisPanel
            title="商业机会"

            items={sections.business}
          />

          {/* 风险分析 */}

          <AnalysisPanel
            title="风险分析"

            items={sections.risk}
          />
        </section>

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
            🤖 AI智能分析
          </h2>

          <div
            className="
mt-4
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
              <h3
                className="
font-bold
text-sm
"
              >
                产业价值
              </h3>

              <p
                className="
mt-2
text-xs
text-gray-400
"
              >
                AI技术持续向应用场景扩展。
              </p>
            </div>

            <div
              className="
border
border-gray-800
rounded-xl
p-4
"
            >
              <h3
                className="
font-bold
text-sm
"
              >
                商业方向
              </h3>

              <p
                className="
mt-2
text-xs
text-gray-400
"
              >
                企业服务和行业解决方案持续发展。
              </p>
            </div>

            <div
              className="
border
border-gray-800
rounded-xl
p-4
"
            >
              <h3
                className="
font-bold
text-sm
"
              >
                关注风险
              </h3>

              <p
                className="
mt-2
text-xs
text-gray-400
"
              >
                关注技术、安全和成本因素。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AnalysisPanel({
  title,

  items,
}: {
  title: string;

  items: string[];
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
text-sm
"
      >
        {title}
      </h3>

      <div
        className="
mt-4
space-y-2
"
      >
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={index}

              className="
text-xs
text-gray-400
border-b
border-gray-900
pb-2
"
            >
              {item}
            </div>
          ))
        ) : (
          <div
            className="
text-xs
text-gray-500
"
          >
            暂无信息
          </div>
        )}
      </div>
    </div>
  );
}

function parseNewsContent(content: string) {
  const getSection = (
    start: string,

    end?: string,
  ) => {
    const startIndex = content.indexOf(start);

    if (startIndex === -1) {
      return "";
    }

    const begin = startIndex + start.length;

    const endIndex = end ? content.indexOf(end, begin) : content.length;

    return content

      .slice(
        begin,

        endIndex === -1 ? content.length : endIndex,
      )

      .trim();
  };

  return {
    core: getSection(
      "【核心内容】",

      "【产业影响】",
    ),

    impact: getSection(
      "【产业影响】",

      "【商业机会】",
    )
      .split("\n")

      .filter(Boolean),

    business: getSection(
      "【商业机会】",

      "【风险分析】",
    )
      .split("\n")

      .filter(Boolean),

    risk: getSection("【风险分析】")
      .split("\n")

      .filter(Boolean),
  };
}
