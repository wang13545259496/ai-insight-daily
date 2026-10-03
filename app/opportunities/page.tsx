import { prisma } from "@/lib/prisma";

export default async function OpportunityPage() {
  const opportunities = await prisma.businessOpportunity.findMany({
    orderBy: {
      createdAt: "desc",
    },

    take: 20,
  });

  return (
    <main
      className="
      min-h-screen
      bg-black
      text-white
      px-8
      py-12
      "
    >
      <div
        className="
        max-w-6xl
        mx-auto
        "
      >
        <h1
          className="
          text-4xl
          font-bold
          mb-4
          "
        >
          AI机会地图
        </h1>

        <p
          className="
          text-gray-400
          mb-10
          "
        >
          探索人工智能时代商业机会
        </p>

        <div
          className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-6
          mb-12
          "
        >
          <div
            className="
            border
            border-gray-800
            rounded-xl
            p-6
            bg-zinc-950
            "
          >
            <div className="text-gray-400">商业机会数量</div>

            <div
              className="
              text-4xl
              font-bold
              mt-3
              "
            >
              {opportunities.length}
            </div>
          </div>

          <div
            className="
            border
            border-gray-800
            rounded-xl
            p-6
            bg-zinc-950
            "
          >
            <div className="text-gray-400">AI产业方向</div>

            <div
              className="
              text-4xl
              font-bold
              mt-3
              "
            >
              {new Set(opportunities.map((item) => item.industry)).size}
            </div>
          </div>

          <div
            className="
            border
            border-gray-800
            rounded-xl
            p-6
            bg-zinc-950
            "
          >
            <div className="text-gray-400">持续趋势</div>

            <div
              className="
              text-4xl
              font-bold
              mt-3
              "
            >
              {new Set(opportunities.map((item) => item.trend)).size}
            </div>
          </div>
        </div>

        <div
          className="
          grid
          md:grid-cols-2
          gap-6
          "
        >
          {opportunities.map((item) => (
            <div
              key={item.id}

              className="
              border
              border-gray-800
              rounded-2xl
              p-8
              bg-neutral-950
              "
            >
              <h2
                className="
                text-2xl
                font-bold
                mb-5
                "
              >
                {item.opportunity}
              </h2>

              <div
                className="
                text-gray-400
                space-y-2
                "
              >
                <p>
                  行业：
                  {item.industry}
                </p>

                <p>
                  趋势：
                  {item.trend}
                </p>

                <p>
                  方向：
                  {item.direction}
                </p>
              </div>

              <p
                className="
                text-gray-300
                mt-6
                leading-7
                "
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
