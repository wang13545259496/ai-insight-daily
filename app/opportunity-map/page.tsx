import { prisma } from "@/lib/prisma";

export default async function OpportunityMapPage() {
  const opportunities = await prisma.businessOpportunity.findMany({
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
商业机会驾驶舱
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
            AI商业机会地图
          </h1>

          <p
            className="
mt-4
text-gray-400
"
          >
            AI创业方向 · 商业机会分析 · 产业价值洞察
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
              title="机会数量"

              value={String(opportunities.length)}
            />

            <MetricCard
              title="分析状态"

              value="运行中"
            />

            <MetricCard
              title="数据节点"

              value={String(opportunities.length)}
            />
          </div>
        </section>
        {/* =====================
AI机会雷达
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
              🚀 AI机会雷达
            </h2>

            <span
              className="
text-sm
text-gray-500
"
            >
              商业机会节点分析
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
            {opportunities.map((item, index) => (
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
                  机会节点 #{index + 1}
                </h3>

                <div
                  className="
mt-5
text-sm
text-gray-400
leading-6
"
                >
                  AI产业应用方向
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
商业价值分析
===================== */}

        <section
          className="
mt-6
grid
md:grid-cols-3
gap-5
"
        >
          <ValueCard
            title="📊 市场需求"

            text="
企业智能化需求

AI应用增长

数字化升级
"
          />

          <ValueCard
            title="💡 创业方向"

            text="
AI工具

智能助手

行业解决方案
"
          />

          <ValueCard
            title="⚠ 风险关注"

            text="
技术成熟度

市场竞争

落地成本
"
          />
        </section>
        {/* =====================
商业机会趋势判断
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
            🧭 商业机会趋势判断
          </h2>

          <p
            className="
mt-4
text-sm
text-gray-400
leading-7
"
          >
            系统根据现有商业机会数据节点、 产业方向变化以及AI应用趋势，
            生成商业机会分析。 重点关注： 企业AI服务、 智能助手、
            行业解决方案等方向。
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

function ValueCard({
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
