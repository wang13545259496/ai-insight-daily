import { prisma } from "../lib/prisma";

async function main() {
  const hotspots = await prisma.industryHotspot.findMany();

  for (const item of hotspots) {
    await prisma.industryTrend.create({
      data: {
        hotspotId: item.id,

        score: item.score,
      },
    });

    console.log("保存趋势:", item.name, item.score);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
