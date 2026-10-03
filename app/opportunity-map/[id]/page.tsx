import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const opportunityId = Number(id);

  const opportunity = await prisma.businessOpportunity.findUnique({
    where: {
      id: opportunityId,
    },

    include: {
      BusinessReport: true,
    },
  });

  if (!opportunity) {
    return (
      <div
        className="
min-h-screen
bg-black
text-white
p-10
"
      >
        <h1
          className="
text-3xl
font-bold
"
        >
          机会不存在
        </h1>
      </div>
    );
  }

  const hotspot = await prisma.industryHotspot.findUnique({
    where: {
      name: opportunity.industry,
    },

    include: {
      trends: {
        orderBy: {
          date: "desc",
        },

        take: 5,
      },
    },
  });

  const relatedEvents = await prisma.newsEvent.findMany({
    where: {
      category: opportunity.industry,
    },

    take: 5,
  });

  const investments = await prisma.investment.findMany({
    where: {
      industry: opportunity.industry,
    },

    take: 5,
  });

  return (
    <div
      className="
min-h-screen
bg-black
text-white
p-10
"
    >
      <Link
        href="/opportunity-map"

        className="
text-gray-400
hover:text-white
"
      >
        ← 返回AI机会地图
      </Link>

      <div
        className="
max-w-6xl
mt-10
"
      >
        <h1
          className="
text-4xl
font-bold
mb-8
"
        >
          {opportunity.opportunity}
        </h1>

        <div
          className="
border
border-gray-800
rounded-2xl
p-8
bg-gray-950
"
        >
          <div
            className="
grid
grid-cols-1
md:grid-cols-3
gap-6
"
          >
            <div>
              <p
                className="
text-gray-500
"
              >
                行业
              </p>

              <p
                className="
text-xl
mt-2
"
              >
                {opportunity.industry}
              </p>
            </div>

            <div>
              <p
                className="
text-gray-500
"
              >
                趋势
              </p>

              <p
                className="
text-xl
mt-2
"
              >
                {opportunity.trend}
              </p>
            </div>

            <div>
              <p
                className="
text-gray-500
"
              >
                方向
              </p>

              <p
                className="
text-xl
mt-2
"
              >
                {opportunity.direction}
              </p>
            </div>
          </div>

          <p
            className="
mt-8
text-gray-300
leading-8
"
          >
            {opportunity.description}
          </p>
        </div>

        {/* 产业趋势 */}

        <div
          className="
mt-12
"
        >
          <h2
            className="
text-3xl
font-bold
mb-6
"
          >
            相关产业趋势
          </h2>

          {!hotspot || hotspot.trends.length === 0 ? (
            <p
              className="
text-gray-500
"
            >
              暂无产业趋势数据
            </p>
          ) : (
            <div
              className="
grid
grid-cols-1
md:grid-cols-2
gap-5
"
            >
              {hotspot.trends.map((item) => (
                <div
                  key={item.id}

                  className="
border
border-gray-800
rounded-xl
p-6
bg-gray-950
"
                >
                  <h3
                    className="
text-xl
font-bold
"
                  >
                    趋势指数：
                    {item.score}
                  </h3>

                  <p
                    className="
text-gray-500
mt-3
"
                  >
                    {item.date.toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 投资机会 */}

        <div
          className="
mt-12
"
        >
          <h2
            className="
text-3xl
font-bold
mb-6
"
          >
            相关投资机会
          </h2>

          {investments.length === 0 ? (
            <p
              className="
text-gray-500
"
            >
              暂无投资数据
            </p>
          ) : (
            <div
              className="
grid
grid-cols-1
md:grid-cols-2
gap-5
"
            >
              {investments.map((item) => (
                <div
                  key={item.id}

                  className="
border
border-gray-800
rounded-xl
p-6
bg-gray-950
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
text-gray-300
mt-3
"
                  >
                    {item.description}
                  </p>

                  <div
                    className="
mt-5
grid
grid-cols-2
gap-3
text-sm
"
                  >
                    <p>
                      商业：
                      {item.businessScore}
                    </p>

                    <p>
                      技术：
                      {item.technologyScore}
                    </p>

                    <p>
                      市场：
                      {item.marketScore}
                    </p>

                    <p>
                      增长：
                      {item.growthScore}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 热点事件 */}

        <div
          className="
mt-12
"
        >
          <h2
            className="
text-3xl
font-bold
mb-6
"
          >
            相关AI热点事件
          </h2>

          {relatedEvents.length === 0 ? (
            <p
              className="
text-gray-500
"
            >
              暂无关联热点事件
            </p>
          ) : (
            <div
              className="
grid
grid-cols-1
md:grid-cols-2
gap-5
"
            >
              {relatedEvents.map((event) => (
                <div
                  key={event.id}

                  className="
border
border-gray-800
rounded-xl
p-6
bg-gray-950
"
                >
                  <h3
                    className="
text-xl
font-bold
"
                  >
                    {event.title}
                  </h3>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 商业报告 */}

        <div
          className="
mt-14
"
        >
          <h2
            className="
text-3xl
font-bold
mb-8
"
          >
            商业分析报告
          </h2>

          {opportunity.BusinessReport.map((report) => (
            <div
              key={report.id}

              className="
border
border-gray-800
rounded-2xl
p-8
bg-gray-950
mb-8
"
            >
              <ReportBlock title="市场分析" content={report.marketAnalysis} />

              <ReportBlock title="用户痛点" content={report.painPoints} />

              <ReportBlock title="AI解决方案" content={report.aiSolution} />

              <ReportBlock title="产品设计" content={report.productDesign} />

              <ReportBlock title="商业模式" content={report.businessModel} />

              <ReportBlock title="风险分析" content={report.riskAnalysis} />

              <ReportBlock title="创业建议" content={report.startupAdvice} />
            </div>
          ))}
        </div>
      </div>
    </div>
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
    <div
      className="
mb-6
"
    >
      <h4
        className="
font-bold
text-lg
mb-2
"
      >
        {title}
      </h4>

      <p
        className="
text-gray-300
leading-8
"
      >
        {content}
      </p>
    </div>
  );
}
