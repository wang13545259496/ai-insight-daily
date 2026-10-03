import { prisma } from "@/lib/prisma";

export default async function OpportunityPage() {
  const opportunities = await prisma.businessOpportunity.findMany({
    orderBy: {
      id: "desc",
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

        {opportunities.length === 0 ? (
          <div
            className="
              border
              border-gray-800
              rounded-xl
              p-8
              text-gray-400
              "
          >
            暂无商业机会数据
          </div>
        ) : (
          <div
            className="
              grid
              md:grid-cols-2
              gap-6
              "
          >
            {opportunities.map((item: any) => (
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
                      mb-4
                      "
                >
                  {item.title}
                </h2>

                <p
                  className="
                      text-gray-400
                      "
                >
                  行业：
                  {item.industry || "AI产业"}
                </p>

                <p
                  className="
                      text-gray-400
                      mt-2
                      "
                >
                  机会等级：
                  {item.level || "分析中"}
                </p>

                <p
                  className="
                      text-gray-300
                      mt-5
                      "
                >
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
