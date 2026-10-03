import { prisma } from "@/lib/prisma";

export default async function AgentPage() {
  const newsCount = await prisma.news.count();

  const eventCount = await prisma.newsEvent.count();

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
Agent生态驾驶舱
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
            AI Agent生态中心
          </h1>

          <p
            className="
mt-4
text-gray-400
"
          >
            AI智能体应用 · 企业服务 · 商业生态分析
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
              title="AI资讯节点"

              value={String(newsCount)}
            />

            <MetricCard
              title="事件分析节点"

              value={String(eventCount)}
            />

            <MetricCard
              title="生态状态"

              value="持续演进"
            />
          </div>
        </section>
        {/* =====================
Agent生态雷达
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
              🤖 Agent生态雷达
            </h2>

            <span
              className="
text-sm
text-gray-500
"
            >
              AI智能体应用方向
            </span>
          </div>

          <div
            className="
mt-6
grid
md:grid-cols-4
gap-5
"
          >
            <AgentCard
              title="企业助手"

              text="
企业知识管理

办公自动化

智能分析
"
            />

            <AgentCard
              title="客服Agent"

              text="
智能客服

用户服务

自动响应
"
            />

            <AgentCard
              title="营销Agent"

              text="
内容生成

市场分析

用户运营
"
            />

            <AgentCard
              title="行业Agent"

              text="
垂直领域

专业服务

场景落地
"
            />
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
          <AnalysisCard
            title="🏢 企业价值"

            text="
提升业务效率

降低运营成本

增强决策能力
"
          />

          <AnalysisCard
            title="💰 商业机会"

            text="
企业服务

行业解决方案

智能应用平台
"
          />

          <AnalysisCard
            title="⚠ 发展关注"

            text="
数据安全

应用稳定性

商业落地
"
          />
        </section>
        {/* =====================
Agent生态趋势判断
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
            🧭 AI Agent发展趋势
          </h2>

          <p
            className="
mt-4
text-sm
text-gray-400
leading-7
"
          >
            系统结合当前AI新闻、 事件分析以及产业方向， 对AI
            Agent生态进行趋势观察。 未来重点关注： 企业智能助手、
            行业自动化Agent、 垂直场景智能服务。
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

function AgentCard({
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
bg-black
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
