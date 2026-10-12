import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RelatedHotspot = {
  id: number;
  name: string;
  category: string;
  score: number;
  trend: string;
  newsCount: number;
  recentNewsCount: number;
  eventCount: number;
  companyScore: number;
  description: string | null;
  trends: {
    id: number;
    date: Date;
    score: number;
  }[];
};

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const opportunityId = Number(id);

  if (!Number.isInteger(opportunityId)) {
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

  /*
   * 产业趋势关联
   *
   * BusinessOpportunity 的 industry 与 IndustryHotspot.name
   * 并不是同一套分类体系。
   *
   * 例如：
   * AI教育 → 属于 AI应用层
   *
   * 因此：
   * 1. 优先精确匹配热点名称
   * 2. 再匹配热点 category
   * 3. 对已知产业层级进行可靠映射
   */
  const hotspotMapping: Record<string, string> = {
    AI教育: "AI应用",
    AI客服: "AI应用",
    企业AI服务: "AI应用",
    AI应用: "AI应用",
    AI智能体: "AI智能体 Agent",
    "AI智能体 Agent": "AI智能体 Agent",
    AI大模型: "AI大模型",
    AI芯片: "AI芯片",
    AI机器人: "AI机器人",
  };

  const mappedHotspotName =
    hotspotMapping[opportunity.industry] ||
    hotspotMapping[opportunity.opportunity] ||
    hotspotMapping[opportunity.direction];

  let hotspot: RelatedHotspot | null = null;

  if (mappedHotspotName) {
    hotspot = (await prisma.industryHotspot.findUnique({
      where: {
        name: mappedHotspotName,
      },

      include: {
        trends: {
          orderBy: {
            date: "desc",
          },

          take: 5,
        },
      },
    })) as RelatedHotspot | null;
  }

  /*
   * 如果没有预定义映射，再尝试行业名称与热点名称/category
   * 的直接匹配。
   */
  if (!hotspot) {
    hotspot = (await prisma.industryHotspot.findFirst({
      where: {
        OR: [
          {
            name: {
              contains: opportunity.industry,
            },
          },
          {
            category: {
              contains: opportunity.industry,
            },
          },
          {
            name: {
              contains: opportunity.direction,
            },
          },
          {
            category: {
              contains: opportunity.direction,
            },
          },
        ],
      },

      include: {
        trends: {
          orderBy: {
            date: "desc",
          },

          take: 5,
        },
      },
    })) as RelatedHotspot | null;
  }

  /*
   * 投资机会
   *
   * 优先按照真实行业匹配。
   * 如果没有，再按照机会名称、方向进行关键词匹配。
   *
   * 不使用“所有AI投资”作为兜底，
   * 防止把无关项目伪装成当前商业机会的投资机会。
   */
  const investmentKeywords = [
    opportunity.industry,
    opportunity.opportunity,
    opportunity.direction,
  ].filter(Boolean);

  const investmentConditions = investmentKeywords.flatMap((keyword) => [
    {
      industry: {
        contains: keyword,
      },
    },
    {
      name: {
        contains: keyword,
      },
    },
    {
      description: {
        contains: keyword,
      },
    },
  ]);

  const investments =
    investmentConditions.length > 0
      ? await prisma.investment.findMany({
          where: {
            OR: investmentConditions,
          },

          orderBy: [
            {
              growthScore: "desc",
            },
            {
              marketScore: "desc",
            },
          ],

          take: 5,
        })
      : [];

  /*
   * AI热点事件
   *
   * 优先匹配：
   * 行业 / 机会 / 方向。
   *
   * 由于 NewsEvent.category 目前主要是 OpenAI、
   * Google AI Blog 等来源分类，因此不能简单把
   * category = AI教育 作为唯一条件。
   *
   * 同时使用 title / keywords 做真实关键词匹配。
   */
  const eventKeywords = [
    opportunity.industry,
    opportunity.opportunity,
    opportunity.direction,
  ]
    .filter(Boolean)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const eventConditions = eventKeywords.flatMap((keyword) => [
    {
      title: {
        contains: keyword,
      },
    },
    {
      keywords: {
        contains: keyword,
      },
    },
    {
      category: {
        contains: keyword,
      },
    },
  ]);

  const relatedEvents =
    eventConditions.length > 0
      ? await prisma.newsEvent.findMany({
          where: {
            OR: eventConditions,
            status: "active",
          },

          orderBy: [
            {
              heatScore: "desc",
            },
            {
              updatedAt: "desc",
            },
          ],

          take: 5,
        })
      : [];

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

          {!hotspot ? (
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
              <div
                className="
border
border-gray-800
rounded-xl
p-6
bg-gray-950
"
              >
                <div
                  className="
flex
items-center
justify-between
gap-4
"
                >
                  <div>
                    <p
                      className="
text-xs
text-gray-500
uppercase
tracking-widest
"
                    >
                      RELATED INDUSTRY
                    </p>

                    <h3
                      className="
text-xl
font-bold
mt-2
"
                    >
                      {hotspot.name}
                    </h3>
                  </div>

                  <div
                    className="
text-right
"
                  >
                    <p
                      className="
text-xs
text-gray-500
"
                    >
                      当前指数
                    </p>

                    <p
                      className="
text-2xl
font-bold
"
                    >
                      {hotspot.score}
                    </p>
                  </div>
                </div>

                <div
                  className="
grid
grid-cols-2
gap-4
mt-6
text-sm
"
                >
                  <div>
                    <p
                      className="
text-gray-500
"
                    >
                      近期资讯
                    </p>

                    <p
                      className="
mt-1
"
                    >
                      {hotspot.recentNewsCount}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
text-gray-500
"
                    >
                      累计资讯
                    </p>

                    <p
                      className="
mt-1
"
                    >
                      {hotspot.newsCount}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
text-gray-500
"
                    >
                      趋势状态
                    </p>

                    <p
                      className="
mt-1
"
                    >
                      {hotspot.trend}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
text-gray-500
"
                    >
                      企业关注度
                    </p>

                    <p
                      className="
mt-1
"
                    >
                      {hotspot.companyScore}
                    </p>
                  </div>
                </div>

                {hotspot.description ? (
                  <p
                    className="
mt-6
text-gray-400
leading-7
"
                  >
                    {hotspot.description}
                  </p>
                ) : null}
              </div>

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
                  <p
                    className="
text-xs
text-gray-500
uppercase
tracking-widest
"
                  >
                    TREND SNAPSHOT
                  </p>

                  <h3
                    className="
text-xl
font-bold
mt-2
"
                  >
                    趋势指数：{item.score}
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
              暂无与该商业机会直接匹配的投资数据
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
              暂无与该商业机会直接匹配的热点事件
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
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="
border
border-gray-800
rounded-xl
p-6
bg-gray-950
hover:border-gray-600
transition
"
                >
                  <div
                    className="
flex
items-start
justify-between
gap-4
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

                    <span
                      className="
text-xs
text-gray-500
shrink-0
"
                    >
                      HEAT {Math.round(event.heatScore)}
                    </span>
                  </div>

                  <p
                    className="
text-gray-500
mt-4
text-sm
"
                  >
                    {event.trendStatus}
                  </p>
                </Link>
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

          {opportunity.BusinessReport.length === 0 ? (
            <p
              className="
text-gray-500
"
            >
              暂无商业分析报告
            </p>
          ) : (
            opportunity.BusinessReport.map((report) => (
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
                <ReportBlock
                  title="市场分析"
                  content={report.marketAnalysis}
                />

                <ReportBlock
                  title="用户痛点"
                  content={report.painPoints}
                />

                <ReportBlock
                  title="AI解决方案"
                  content={report.aiSolution}
                />

                <ReportBlock
                  title="产品设计"
                  content={report.productDesign}
                />

                <ReportBlock
                  title="商业模式"
                  content={report.businessModel}
                />

                <ReportBlock
                  title="风险分析"
                  content={report.riskAnalysis}
                />

                <ReportBlock
                  title="创业建议"
                  content={report.startupAdvice}
                />
              </div>
            ))
          )}
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
