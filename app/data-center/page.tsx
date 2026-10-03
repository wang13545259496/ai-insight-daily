import DashboardCard from "@/components/DashboardCard";
import AIIndexCard from "@/components/AIIndexCard";
import TrendChart from "@/components/TrendChart";
import CategoryHeatChart from "@/components/CategoryHeatChart";

import { getEventStats } from "@/lib/dashboard/eventStats";
import { getRealtimeStats } from "@/lib/dashboard/realtimeStats";
import { getAIIndex } from "@/lib/dashboard/aiIndex";
import { getTrendData } from "@/lib/dashboard/trendData";
import { getCategoryHeat } from "@/lib/dashboard/categoryHeat";

function EmptyChart({ title }: { title: string }) {
  return (
    <div
      className="
border
border-gray-800
rounded-xl
h-72
flex
items-center
justify-center
text-gray-500
text-sm
"
    >
      📊 {title} 数据积累中
    </div>
  );
}

export default async function DataCenterPage() {
  const stats = await getRealtimeStats();

  const index = await getAIIndex();

  const trend = await getTrendData();

  const categoryHeat = await getCategoryHeat();

  const eventStats = await getEventStats();

  return (
    <main
      className="
min-h-screen
bg-black
text-white
px-6
py-10
"
    >
      <section
        className="
max-w-7xl
mx-auto
space-y-8
"
      >
        {/* 标题 */}

        <section>
          <h1
            className="
text-4xl
font-bold
"
          >
            AI实时数据中心
          </h1>

          <p
            className="
text-gray-400
mt-3
"
          >
            AI产业动态监控、趋势分析与智能决策平台
          </p>
        </section>

        {/* 核心指标 */}

        <section>
          <h2
            className="
text-xl
font-bold
mb-4
"
          >
            实时数据指标
          </h2>

          <div
            className="
grid
grid-cols-2
lg:grid-cols-4
gap-4
"
          >
            <DashboardCard
              title="新闻总量"

              value={stats.totalNews}

              desc="AI新闻数据库"
            />

            <DashboardCard
              title="今日新增"

              value={stats.todayNews}

              desc="今日采集"
            />

            <DashboardCard
              title="数据来源"

              value={stats.totalSources}

              desc="RSS来源"
            />

            <DashboardCard
              title="验证通过率"

              value={`${stats.verificationRate}%`}

              desc="质量检测"
            />
          </div>
        </section>

        {/* AI指数 */}

        <section>
          <h2
            className="
text-xl
font-bold
mb-4
"
          >
            AI行业指数
          </h2>

          <div
            className="
grid
grid-cols-2
lg:grid-cols-4
gap-4
"
          >
            <AIIndexCard
              title="AI综合指数"

              value={index.overallIndex}

              desc="行业活跃度"
            />

            <AIIndexCard
              title="模型发展指数"

              value={index.modelIndex}

              desc="大模型趋势"
            />

            <AIIndexCard
              title="Agent指数"

              value={index.agentIndex}

              desc="智能体生态"
            />

            <AIIndexCard
              title="企业应用指数"

              value={index.enterpriseIndex}

              desc="商业应用"
            />
          </div>
        </section>

        {/* 事件中心 */}

        <section>
          <h2
            className="
text-xl
font-bold
mb-4
"
          >
            AI热点事件中心
          </h2>

          <div
            className="
grid
grid-cols-2
lg:grid-cols-4
gap-4
mb-5
"
          >
            <DashboardCard
              title="事件总量"

              value={eventStats.totalEvents}

              desc="自动聚类"
            />

            <DashboardCard
              title="活跃事件"

              value={eventStats.activeEvents}

              desc="持续关注"
            />

            <DashboardCard
              title="上升事件"

              value={eventStats.risingEvents}

              desc="增长趋势"
            />

            <DashboardCard
              title="平均热度"

              value={eventStats.averageHeat}

              desc="事件指数"
            />
          </div>

          <div
            className="
border
border-gray-800
rounded-xl
p-6
"
          >
            <h3
              className="
font-bold
mb-5
"
            >
              🔥 热点事件排行
            </h3>

            <div
              className="
space-y-3
"
            >
              {eventStats.hotEvents.map((event, index) => (
                <div
                  key={event.id}
                  className="
border-b
border-gray-800
pb-3
"
                >
                  <div
                    className="
font-medium
"
                  >
                    #{index + 1}
                    &nbsp;
                    {event.title}
                  </div>

                  <div
                    className="
text-sm
text-gray-500
mt-1
"
                  >
                    热度：
                    {event.heatScore}
                    &nbsp; 趋势：
                    <span>{event.trendStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 趋势 */}

        <section>
          <h2
            className="
text-xl
font-bold
mb-4
"
          >
            AI趋势分析
          </h2>

          {trend && trend.length > 0 ? (
            <TrendChart data={trend} />
          ) : (
            <EmptyChart title="新闻增长趋势" />
          )}
        </section>

        {/* 热度 */}

        <section>
          <h2
            className="
text-xl
font-bold
mb-4
"
          >
            AI领域热度分布
          </h2>

          {categoryHeat && categoryHeat.length > 0 ? (
            <CategoryHeatChart data={categoryHeat} />
          ) : (
            <EmptyChart title="领域热度" />
          )}
        </section>
      </section>
    </main>
  );
}
