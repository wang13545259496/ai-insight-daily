import { prisma } from "@/lib/prisma";

export default async function IndustryPage() {
  const newsCount = await prisma.news.count();

  const eventCount = await prisma.newsEvent.count();

  const trendCount = await prisma.industryTrend.count();

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
顶部标题区域
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
            AI产业智能分析中心
          </h1>

          <p
            className="
mt-4
text-gray-400
leading-7
"
          >
            AI产业趋势、 热点事件、 商业机会与未来方向综合分析平台。
          </p>

          <div
            className="
mt-8
grid
md:grid-cols-4
gap-5
"
          >
            <MetricCard
              title="新闻数据"

              value={String(newsCount)}
            />

            <MetricCard
              title="事件数量"

              value={String(eventCount)}
            />

            <MetricCard
              title="趋势节点"

              value={String(trendCount)}
            />

            <MetricCard
              title="系统状态"

              value="运行中"
            />
          </div>
        </section>
        {/* =====================
产业趋势雷达 + 价值分析
===================== */}

        <section
          className="
mt-6
grid
lg:grid-cols-2
gap-6
"
        >
          {/* 趋势雷达 */}

          <div
            className="
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
                🔥 AI产业趋势雷达
              </h2>

              <span
                className="
text-sm
text-gray-500
"
              >
                趋势节点
              </span>
            </div>

            <div
              className="
mt-6
grid
grid-cols-2
gap-4
"
            >
              <TrendCard
                title="产业方向"

                text="AI应用生态"
              />

              <TrendCard
                title="技术趋势"

                text="智能化升级"
              />

              <TrendCard
                title="商业方向"

                text="企业服务"
              />

              <TrendCard
                title="未来机会"

                text="行业解决方案"
              />
            </div>
          </div>

          {/* 商业价值分析 */}

          <div
            className="
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
              💡 产业价值分析
            </h2>

            <div
              className="
mt-6
space-y-4
"
            >
              <InfoRow
                title="商业机会"

                text="AI应用工具、企业智能助手、行业解决方案"
              />

              <InfoRow
                title="投资关注"

                text="AI基础设施、企业服务、智能应用"
              />

              <InfoRow
                title="发展方向"

                text="从模型能力走向产业落地"
              />
            </div>
          </div>
        </section>
        {/* =====================
产业趋势判断
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
            🧭 AI产业趋势判断
          </h2>

          <p
            className="
mt-4
text-sm
text-gray-400
leading-7
"
          >
            系统结合当前新闻数据、 事件变化以及产业趋势节点，
            持续观察AI产业发展方向。 重点关注： 企业智能化升级、
            AI应用生态扩展、 行业解决方案落地。
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

function TrendCard({
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
"
      >
        {text}
      </p>
    </div>
  );
}

function InfoRow({
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
rounded-xl
p-4
"
    >
      <div
        className="
font-bold
"
      >
        {title}
      </div>

      <div
        className="
mt-2
text-sm
text-gray-500
"
      >
        {text}
      </div>
    </div>
  );
}
