import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function StartupDetailPage({
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

  // 容错处理

  if (!opportunity) {
    const available = await prisma.businessOpportunity.findMany({
      orderBy: {
        createdAt: "desc",
      },

      take: 6,
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
max-w-5xl
mx-auto
"
        >
          <h1
            className="
text-4xl
font-bold
"
          >
            创业机会不存在
          </h1>

          <p
            className="
mt-5
text-gray-400
"
          >
            当前创业机会 ID：
            {id}
            不存在。 请选择已有创业方向：
          </p>

          <div
            className="
mt-10
grid
grid-cols-1
md:grid-cols-3
gap-6
"
          >
            {available.map((item) => (
              <Link
                key={item.id}

                href={`/startup/${item.id}`}

                className="
border
border-gray-800
rounded-xl
p-6
bg-gray-950
hover:border-gray-500
"
              >
                <p
                  className="
text-gray-400
text-sm
"
                >
                  ID {item.id}
                </p>

                <h2
                  className="
text-xl
font-bold
mt-3
"
                >
                  {item.opportunity}
                </h2>

                <p
                  className="
mt-3
text-gray-400
"
                >
                  {item.industry}
                </p>
              </Link>
            ))}
          </div>

          <Link
            href="/startup"

            className="
inline-block
mt-10
border
border-gray-700
rounded-lg
px-5
py-3
hover:bg-white
hover:text-black
"
          >
            返回AI创业发现
          </Link>
        </div>
      </div>
    );
  }

  const report = opportunity.BusinessReport[0];

  const investment = await prisma.investment.findFirst({
    where: {
      industry: opportunity.industry,
    },
  });

  const startupScore = investment
    ? Math.round(
        (investment.businessScore +
          investment.marketScore +
          investment.growthScore +
          investment.technologyScore) /
          4,
      )
    : 60;

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
max-w-6xl
mx-auto
"
      >
        <Link
          href="/startup"

          className="
text-gray-400
hover:text-white
"
        >
          ← 返回AI创业发现
        </Link>

        <div
          className="
mt-10
"
        >
          <h1
            className="
text-5xl
font-bold
"
          >
            {opportunity.opportunity}
          </h1>

          <p
            className="
mt-5
text-xl
text-gray-400
"
          >
            AI创业商业分析报告
          </p>
        </div>

        <div
          className="
mt-10
grid
grid-cols-1
md:grid-cols-4
gap-5
"
        >
          <Card
            title="行业"

            value={opportunity.industry}
          />

          <Card
            title="趋势"

            value={opportunity.trend}
          />

          <Card
            title="方向"

            value={opportunity.direction}
          />

          <Card
            title="创业指数"

            value={String(startupScore)}
          />
        </div>

        <Section title="市场机会">
          <p>{opportunity.description}</p>
        </Section>

        {report && (
          <Section title="创业方案">
            <Block
              title="市场分析"

              value={report.marketAnalysis}
            />

            <Block
              title="用户痛点"

              value={report.painPoints}
            />

            <Block
              title="AI解决方案"

              value={report.aiSolution}
            />

            <Block
              title="产品设计"

              value={report.productDesign}
            />

            <Block
              title="商业模式"

              value={report.businessModel}
            />

            <Block
              title="风险分析"

              value={report.riskAnalysis}
            />

            <Block
              title="创业建议"

              value={report.startupAdvice}
            />
          </Section>
        )}

        <Section title="投资价值分析">
          {investment ? (
            <div
              className="
grid
grid-cols-2
md:grid-cols-5
gap-5
"
            >
              <Score
                title="商业"

                value={investment.businessScore}
              />

              <Score
                title="技术"

                value={investment.technologyScore}
              />

              <Score
                title="市场"

                value={investment.marketScore}
              />

              <Score
                title="增长"

                value={investment.growthScore}
              />

              <Score
                title="风险"

                value={investment.riskScore}
              />
            </div>
          ) : (
            <p
              className="
text-gray-400
"
            >
              暂无投资分析数据
            </p>
          )}
        </Section>

        <Section title="AI创业路径">
          <div
            className="
grid
grid-cols-1
md:grid-cols-5
gap-4
"
          >
            {["产业机会", "用户需求", "AI产品", "商业模式", "投资价值"].map(
              (item) => (
                <div
                  key={item}

                  className="
border
border-gray-800
rounded-xl
p-5
text-center
bg-gray-950
"
                >
                  {item}
                </div>
              ),
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,

  children,
}: {
  title: string;

  children: React.ReactNode;
}) {
  return (
    <section
      className="
mt-10
border
border-gray-800
rounded-2xl
p-8
bg-gray-950
"
    >
      <h2
        className="
text-3xl
font-bold
mb-8
"
      >
        {title}
      </h2>

      <div
        className="
text-gray-300
leading-8
"
      >
        {children}
      </div>
    </section>
  );
}

function Block({
  title,

  value,
}: {
  title: string;

  value: string;
}) {
  return (
    <div
      className="
mb-8
"
    >
      <h3
        className="
text-xl
font-bold
mb-3
"
      >
        {title}
      </h3>

      <p>{value || "暂无"}</p>
    </div>
  );
}

function Card({
  title,

  value,
}: {
  title: string;

  value: string;
}) {
  return (
    <div
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
text-gray-400
text-sm
"
      >
        {title}
      </p>

      <p
        className="
text-xl
font-bold
mt-3
"
      >
        {value || "暂无"}
      </p>
    </div>
  );
}

function Score({
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
p-5
text-center
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
