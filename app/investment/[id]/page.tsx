import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import InvestmentExport from "@/components/InvestmentExport";
import InvestmentPDF from "@/components/InvestmentPDF";
import { generateMarkdownReport } from "@/lib/investment/export";
import { calculateInvestmentScore } from "@/lib/scoring/investmentScore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvestmentDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const investmentId = Number(id);

  if (!Number.isInteger(investmentId) || investmentId <= 0) {
    notFound();
  }

  const company = await prisma.investment.findUnique({
    where: {
      id: investmentId,
    },
  });

  if (!company) {
    notFound();
  }

  const score = calculateInvestmentScore({
    businessScore: company.businessScore,
    technologyScore: company.technologyScore,
    marketScore: company.marketScore,
    growthScore: company.growthScore,
    riskScore: company.riskScore,
  });

  const riskControlScore = 100 - company.riskScore;

  const advantages: string[] = [];

  if (company.businessScore >= 80) {
    advantages.push("商业模式具备较强成熟度。");
  }

  if (company.technologyScore >= 80) {
    advantages.push("技术能力处于较高水平。");
  }

  if (company.marketScore >= 80) {
    advantages.push("目标市场空间较大。");
  }

  if (company.growthScore >= 80) {
    advantages.push("成长潜力较高。");
  }

  if (riskControlScore >= 70) {
    advantages.push("风险控制表现相对较好。");
  }

  const risks: string[] = [];

  if (company.businessScore < 60) {
    risks.push("商业模式成熟度仍需要进一步验证。");
  }

  if (company.technologyScore < 60) {
    risks.push("技术能力仍存在进一步验证空间。");
  }

  if (company.marketScore < 60) {
    risks.push("市场空间仍需要持续观察。");
  }

  if (company.growthScore < 60) {
    risks.push("成长能力需要更多实际数据验证。");
  }

  if (company.riskScore >= 70) {
    risks.push("当前风险等级较高，需要重点关注技术竞争、商业化和市场变化。");
  }

  if (risks.length === 0) {
    risks.push("当前未发现单项特别突出的风险指标，但仍需持续跟踪实际业务表现。");
  }

  const report = {
    overview:
      `${company.name}属于${company.industry}领域。` +
      `当前数据库记录的综合投资评分为${score.score}分，` +
      `投资关注等级为${score.level}。` +
      `该判断基于商业模式、技术能力、市场空间、成长能力和风险控制五个维度。`,

    business:
      `商业模式评分为${company.businessScore}分。` +
      `当前项目的商业价值判断主要依据数据库中的商业模式评分，` +
      `实际商业化能力仍需要结合客户需求、收入模式、客户规模以及持续经营能力进行验证。`,

    technology:
      `技术能力评分为${company.technologyScore}分。` +
      `技术竞争力需要结合产品能力、技术壁垒、数据积累以及持续研发能力进行判断，` +
      `当前页面仅展示数据库已经形成的评分结果，不额外虚构技术事实。`,

    market:
      `市场空间评分为${company.marketScore}分。` +
      `该评分用于衡量当前数据库对项目市场机会的判断，` +
      `实际市场规模和竞争格局仍需要结合后续产业数据持续验证。`,

    growth:
      `成长能力评分为${company.growthScore}分。` +
      `成长判断主要关注业务扩张、市场渗透和持续增长潜力，` +
      `最终表现需要以后续真实经营和产业数据进行验证。`,

    risk:
      `风险等级为${company.riskScore}分，风险控制分为${riskControlScore}分。` +
      `风险等级越高代表风险越高，因此综合投资评分中使用100减去风险等级后的风险控制分参与计算。`,

    summary:
      `当前综合投资评分为${score.score}分，投资关注等级为${score.level}。` +
      `${score.reason}。` +
      `本报告仅基于当前Investment数据库中的真实记录和评分结果生成，` +
      `不将不存在于数据库中的企业、融资事件或市场数据作为事实展示。`,
  };

  const markdown = generateMarkdownReport(
    company.name,
    report,
  );

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
            INVESTMENT INTELLIGENCE
          </div>

          <h1 className="mt-4 text-4xl font-bold">
            {company.name}
          </h1>

          <p className="mt-3 text-lg text-gray-400">
            {company.industry}
          </p>

          <p className="mt-5 max-w-3xl leading-7 text-gray-400">
            {company.description}
          </p>
        </div>

        <section className="rounded-xl border border-gray-800 bg-gray-950 p-8">
          <h2 className="text-2xl font-bold">
            AI投资价值评级
          </h2>

          <div className="mt-8 grid gap-8 md:grid-cols-[180px_1fr] md:items-center">
            <div>
              <p className="text-gray-400">
                综合评分
              </p>

              <p className="mt-2 text-6xl font-bold">
                {score.score}
              </p>

              <p className="mt-2 text-sm text-gray-400">
                / 100
              </p>
            </div>

            <div>
              <p className="text-4xl font-bold">
                {score.level}
              </p>

              <p className="mt-4 leading-7 text-gray-400">
                {score.reason}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-5 text-2xl font-bold">
            五维投资评分
          </h2>

          <div className="grid gap-5 md:grid-cols-5">
            <ScoreCard
              title="商业模式"
              score={company.businessScore}
            />

            <ScoreCard
              title="技术能力"
              score={company.technologyScore}
            />

            <ScoreCard
              title="市场空间"
              score={company.marketScore}
            />

            <ScoreCard
              title="成长能力"
              score={company.growthScore}
            />

            <ScoreCard
              title="风险控制"
              score={riskControlScore}
              description={`风险等级 ${company.riskScore}`}
            />
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-gray-800 p-8">
          <h2 className="mb-6 text-2xl font-bold">
            AI价值优势
          </h2>

          {advantages.length > 0 ? (
            <div className="space-y-4">
              {advantages.map((item, index) => (
                <p
                  key={index}
                  className="leading-7 text-gray-300"
                >
                  ✓ {item}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">
              当前数据库评分没有形成明显优势项。
            </p>
          )}
        </section>

        <section className="mt-10 rounded-xl border border-gray-800 p-8">
          <h2 className="mb-6 text-2xl font-bold">
            AI风险分析
          </h2>

          <div className="space-y-4">
            {risks.map((item, index) => (
              <p
                key={index}
                className="leading-7 text-gray-300"
              >
                ⚠ {item}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-gray-800 p-8">
          <h2 className="mb-8 text-3xl font-bold">
            AI投资研究报告
          </h2>

          <div className="mb-8 flex flex-wrap gap-5">
            <InvestmentExport
              content={markdown}
              filename={`${company.name}-AI投资报告.md`}
            />

            <InvestmentPDF
              title={`${company.name} AI投资研究报告`}
              content={markdown}
            />
          </div>

          <div className="space-y-10 leading-8 text-gray-300">
            <ReportSection
              title="一、项目概览"
              content={report.overview}
            />

            <ReportSection
              title="二、商业模式分析"
              content={report.business}
            />

            <ReportSection
              title="三、技术竞争力分析"
              content={report.technology}
            />

            <ReportSection
              title="四、市场空间分析"
              content={report.market}
            />

            <ReportSection
              title="五、成长趋势分析"
              content={report.growth}
            />

            <ReportSection
              title="六、风险因素分析"
              content={report.risk}
            />

            <ReportSection
              title="七、AI投资总结"
              content={report.summary}
            />
          </div>
        </section>

        <div className="mt-10 border-t border-gray-800 pt-6 text-sm text-gray-400">
          数据来源：AI Insight Daily Investment 数据库
        </div>
      </div>
    </main>
  );
}

function ScoreCard({
  title,
  score,
  description,
}: {
  title: string;
  score: number;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 p-5">
      <p className="text-gray-400">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold">
        {score}
      </p>

      <p className="mt-2 text-xs text-gray-400">
        / 100
      </p>

      <div className="mt-4 h-1.5 bg-gray-800">
        <div
          className="h-1.5 bg-white"
          style={{
            width: `${Math.min(Math.max(score, 0), 100)}%`,
          }}
        />
      </div>

      {description ? (
        <p className="mt-3 text-xs text-gray-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function ReportSection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <div>
      <h3 className="text-xl font-bold text-white">
        {title}
      </h3>

      <p className="mt-3">
        {content}
      </p>
    </div>
  );
}
