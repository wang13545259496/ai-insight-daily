import { prisma } from "@/lib/prisma";
import StartupSearch from "./StartupSearch";

export default async function StartupDiscoveryPage() {
  const hotspots = await prisma.industryHotspot.findMany({
    orderBy: {
      score: "desc",
    },

    take: 20,
  });

  const opportunities = await prisma.businessOpportunity.findMany({
    orderBy: {
      createdAt: "desc",
    },

    take: 50,
  });

  const startupProjects = hotspots.map((hotspot) => {
    const related = opportunities.filter((item) => {
      const text = (
        item.industry +
        item.opportunity +
        item.direction +
        item.description
      ).toLowerCase();

      return (
        text.includes(hotspot.category.toLowerCase()) ||
        text.includes(hotspot.name.toLowerCase()) ||
        hotspot.keywords
          .toLowerCase()
          .split(",")
          .some((keyword) => text.includes(keyword.toLowerCase()))
      );
    });

    return {
      id: hotspot.id,

      name: hotspot.name,

      category: hotspot.category,

      score: hotspot.score,

      trend: hotspot.trend,

      description: hotspot.description || "AI产业方向",

      opportunities: related.slice(0, 5),
    };
  });

  return (
    <main
      className="
      min-h-screen
      bg-black
      text-white
      p-10
      "
    >
      <section
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
          AI创业发现系统
        </h1>

        <p
          className="
          text-gray-400
          mb-10
          "
        >
          基于产业趋势和商业机会自动发现创业方向
        </p>

        <StartupSearch projects={startupProjects} />
      </section>
    </main>
  );
}
