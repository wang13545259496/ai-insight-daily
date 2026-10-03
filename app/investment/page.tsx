import { prisma } from "@/lib/prisma";

export default async function InvestmentPage() {
  const investments = await prisma.investment.findMany({
    take: 12,
  });

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
投资观察驾驶舱
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
          <h1
            className="
text-4xl
font-bold
"
          >
            AI投资观察中心
          </h1>

          <p
            className="
mt-4
text-gray-400
"
          >
            AI企业方向 · 商业价值 · 投资趋势分析
          </p>

          <div
            className="
mt-8
grid
md:grid-cols-3
gap-5
"
          >
            <MetricCard
              title="观察项目"

              value={String(investments.length)}
            />

            <MetricCard
              title="分析状态"

              value="运行中"
            />

            <MetricCard
              title="AI赛道"

              value="持续跟踪"
            />
          </div>
        </section>
        {/* =====================
投资机会雷达
===================== */}

        <section
          className="
mt-6
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
text-2xl
font-bold
"
            >
              💰 投资机会雷达
            </h2>

            <span
              className="
text-sm
text-gray-500
"
            >
              AI赛道观察
            </span>
          </div>

          <div
            className="
mt-6
grid
md:grid-cols-3
gap-5
"
          >
            {investments.map((item, index) => (
              <div
                key={item.id}

                className="
border
border-gray-800
rounded-2xl
bg-black
p-5
"
              >
                <h3
                  className="
font-bold
"
                >
                  投资方向 #{index + 1}
                </h3>

                <div
                  className="
mt-4
text-sm
text-gray-400
leading-6
"
                >
                  AI产业投资观察节点
                </div>

                <div
                  className="
mt-4
border
border-gray-800
rounded-xl
p-3
text-sm
text-gray-500
"
                >
                  数据编号：
                  {item.id}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =====================
投资逻辑分析
===================== */}

        <section
          className="
mt-6
grid
md:grid-cols-3
gap-5
"
        >
          <AnalysisCard
            title="📈 增长方向"

            text="
AI应用生态

企业智能化

行业解决方案
"
          />

          <AnalysisCard
            title="🏭 产业价值"

            text="
商业模式探索

企业服务升级

应用场景扩展
"
          />

          <AnalysisCard
            title="⚠ 风险关注"

            text="
技术变化

市场竞争

落地成本
"
          />
        </section>
        {/* =====================
投资趋势判断
===================== */}

        <section
          className="
mt-6
border
border-gray-800
rounded-3xl
bg-gray-950
p-8
"
        >
          <h2
            className="
text-2xl
font-bold
"
          >
            🧭 AI投资趋势判断
          </h2>

          <p
            className="
mt-4
text-sm
text-gray-400
leading-7
"
          >
            系统根据已有投资观察数据、 AI产业发展方向以及商业机会变化，
            持续跟踪重点投资方向。 重点关注： 企业AI服务、 智能应用、
            行业解决方案等领域。
          </p>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
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
rounded-2xl
bg-black
p-5
"
    >
      <div
        className="
text-sm
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
"
      >
        {title}
      </h3>

      <p
        className="
mt-3
text-sm
text-gray-500
leading-6
whitespace-pre-line
"
      >
        {text}
      </p>
    </div>
  );
}
