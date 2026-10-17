interface AgentTrendCardProps {
  name: string;

  trendValue: number;

  trend: string;

  direction: string;

  desc: string;
}

export default function AgentTrendCard({
  name,

  trendValue,

  trend,

  direction,

  desc,
}: AgentTrendCardProps) {
  return (
    <div
      className="

border

border-gray-800

rounded-2xl

p-8

bg-neutral-950

hover:border-white

transition

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
          {name}
        </h2>

        <span
          className="
border
border-gray-700
rounded-full
px-4
py-1
text-sm
"
        >
          {trend}
        </span>
      </div>

      <div
        className="
mt-8
text-center
"
      >
        <div
          className="
text-6xl
font-bold
"
        >
          {trendValue}
        </div>

        <p
          className="
mt-3
text-gray-400
"
        >
          趋势预测指数
        </p>
      </div>

      <div
        className="
mt-8
"
      >
        <div
          className="
h-3
bg-gray-800
rounded-full
overflow-hidden
"
        >
          <div
            className="
h-full
bg-white
"

            style={{
              width: `${trendValue}%`,
            }}
          />
        </div>
      </div>

      <div
        className="
mt-8
"
      >
        <p
          className="
text-gray-400
"
        >
          {desc}
        </p>
      </div>

      <div
        className="
mt-4
text-sm
text-gray-400
"
      >
        方向：
        {direction}
      </div>
    </div>
  );
}
