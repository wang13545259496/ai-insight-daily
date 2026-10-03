import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function classify(title: string) {
  const text = title.toLowerCase();

  let type = "unknown";

  let score = 40;

  // 产品发布

  if (
    text.includes("launch") ||
    text.includes("release") ||
    text.includes("发布") ||
    text.includes("推出")
  ) {
    type = "product";

    score = 85;
  }

  // 公司动态
  else if (
    text.includes("openai") ||
    text.includes("google") ||
    text.includes("microsoft") ||
    text.includes("anthropic") ||
    text.includes("公司")
  ) {
    type = "company";

    score = 80;
  }

  // 投融资
  else if (
    text.includes("fund") ||
    text.includes("investment") ||
    text.includes("融资") ||
    text.includes("投资")
  ) {
    type = "investment";

    score = 90;
  }

  // 政策行业
  else if (
    text.includes("policy") ||
    text.includes("regulation") ||
    text.includes("政策")
  ) {
    type = "policy";

    score = 75;
  }

  // 学术研究
  else if (
    text.includes("paper") ||
    text.includes("research") ||
    text.includes("gan") ||
    text.includes("transformer") ||
    text.includes("model")
  ) {
    type = "research";

    score = 55;
  }

  return {
    type,

    score,
  };
}

async function main() {
  console.log("开始AI事件质量分类...");

  const events = await prisma.newsEvent.findMany();

  for (const event of events) {
    const result = classify(event.title);

    await prisma.newsEvent.update({
      where: {
        id: event.id,
      },

      data: {
        eventType: result.type,

        qualityScore: result.score,
      },
    });

    console.log(
      `${event.title}

类型:${result.type}

质量:${result.score}`,
    );
  }

  console.log("事件质量分类完成");
}

main()
  .catch((error) => {
    console.error(error);
  })

  .finally(async () => {
    await prisma.$disconnect();
  });
