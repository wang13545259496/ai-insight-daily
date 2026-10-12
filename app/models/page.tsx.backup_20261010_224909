export default function ModelsPage() {
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
模型生态驾驶舱
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
            AI模型生态中心
          </h1>

          <p
            className="
mt-4
text-gray-400
"
          >
            基础模型观察 · 企业应用生态 · AI技术趋势分析
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
              title="模型生态"

              value="持续发展"
            />

            <MetricCard
              title="技术方向"

              value="AI基础模型"
            />

            <MetricCard
              title="应用趋势"

              value="快速增长"
            />
          </div>
        </section>
        {/* =====================
模型生态雷达
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
              🤖 模型生态雷达
            </h2>

            <span
              className="
text-sm
text-gray-500
"
            >
              AI技术生态观察
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
            <ModelCard
              title="基础模型"

              text="
大语言模型

多模态模型

推理模型
"
            />

            <ModelCard
              title="企业模型应用"

              text="
企业知识库

智能助手

业务自动化
"
            />

            <ModelCard
              title="开源生态"

              text="
开发者社区

开放模型

技术创新
"
            />
          </div>
        </section>

        {/* =====================
模型价值分析
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

增强智能化能力
"
          />

          <AnalysisCard
            title="🚀 应用方向"

            text="
AI助手

行业应用

智能服务
"
          />

          <AnalysisCard
            title="⚠ 关注方向"

            text="
模型能力

数据安全

商业落地
"
          />
        </section>
        {/* =====================
模型生态趋势判断
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
            🧭 AI模型生态趋势判断
          </h2>

          <p
            className="
mt-4
text-sm
text-gray-400
leading-7
"
          >
            AI模型正在从单纯能力竞争， 逐步进入应用生态竞争阶段。 未来重点关注：
            基础模型能力提升、 企业模型部署、 行业智能化应用。
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

function ModelCard({
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
