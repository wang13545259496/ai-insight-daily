import Link from "next/link";

import { prisma } from "@/lib/prisma";

import StartupClient from "./StartupClient";

export default async function StartupPage() {
  const opportunities = await prisma.businessOpportunity.findMany({
    include: {
      BusinessReport: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  const investments = await prisma.investment.findMany({
    orderBy: {
      growthScore: "desc",
    },

    take: 100,
  });

  const data = opportunities.map((item) => {
    const report =
      item.BusinessReport.length > 0 ? item.BusinessReport[0] : null;

    const investment =
      investments.find((inv) => inv.industry === item.industry) || null;

    return {
      id: item.id,

      industry: item.industry,

      opportunity: item.opportunity,

      trend: item.trend,

      direction: item.direction,

      description: item.description,

      createdAt: item.createdAt.toISOString(),

      report: report
        ? {
            marketAnalysis: report.marketAnalysis,

            painPoints: report.painPoints,

            aiSolution: report.aiSolution,

            productDesign: report.productDesign,

            businessModel: report.businessModel,

            riskAnalysis: report.riskAnalysis,

            startupAdvice: report.startupAdvice,
          }
        : null,

      investment: investment
        ? {
            name: investment.name,

            businessScore: investment.businessScore,

            technologyScore: investment.technologyScore,

            marketScore: investment.marketScore,

            growthScore: investment.growthScore,

            riskScore: investment.riskScore,
          }
        : null,
    };
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
      <div
        className="
max-w-7xl
mx-auto
"
      >
        {/* 顶部 */}

        <div
          className="
flex
justify-between
items-start
flex-wrap
gap-6
"
        >
          <div>
            <h1
              className="
text-5xl
font-bold
"
            >
              AI创业发现
            </h1>

            <p
              className="
mt-5
text-xl
text-gray-400
"
            >
              从产业机会发现创业方向，连接商业方案与投资价值
            </p>

            <p
              className="
mt-3
text-gray-400
"
            >
              机会 → 产品 → 商业模式 → 投资分析
            </p>
          </div>

          <div
            className="
flex
gap-4
"
          >
            <Link
              href="/opportunity-map"

              className="
border
border-gray-700
rounded-xl
px-6
py-3
hover:bg-white
hover:text-black
transition
"
            >
              ← AI机会地图
            </Link>

            <Link
              href="/investment"

              className="
border
border-gray-700
rounded-xl
px-6
py-3
hover:bg-white
hover:text-black
transition
"
            >
              投资分析 →
            </Link>
          </div>
        </div>

        {/* 数据驾驶舱 */}

        <div
          className="
mt-14
grid
grid-cols-1
md:grid-cols-3
gap-6
"
        >
          <div
            className="
border
border-gray-800
rounded-2xl
p-8
bg-gray-950
"
          >
            <p
              className="
text-gray-400
"
            >
              创业机会
            </p>

            <p
              className="
text-5xl
font-bold
mt-4
"
            >
              {data.length}
            </p>
          </div>

          <div
            className="
border
border-gray-800
rounded-2xl
p-8
bg-gray-950
"
          >
            <p
              className="
text-gray-400
"
            >
              商业方案
            </p>

            <p
              className="
text-5xl
font-bold
mt-4
"
            >
              {data.filter((item) => item.report).length}
            </p>
          </div>

          <div
            className="
border
border-gray-800
rounded-2xl
p-8
bg-gray-950
"
          >
            <p
              className="
text-gray-400
"
            >
              投资关联
            </p>

            <p
              className="
text-5xl
font-bold
mt-4
"
            >
              {data.filter((item) => item.investment).length}
            </p>
          </div>
        </div>

        {/* 主体 */}

        <div
          className="
mt-14
"
        >
          <StartupClient data={data} />
        </div>

        {/* 创业闭环 */}

        <div
          className="
mt-20
"
        >
          <h2
            className="
text-3xl
font-bold
"
          >
            AI创业生态闭环
          </h2>

          <div
            className="
grid
grid-cols-1
md:grid-cols-4
gap-5
mt-8
"
          >
            {["产业机会", "创业方案", "产品设计", "投资价值"].map((item) => (
              <div
                key={item}

                className="
border
border-gray-800
rounded-xl
p-6
bg-gray-950
text-center
"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
