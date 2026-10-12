import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function classify(title: string) {
  const text = title.toLowerCase();

  let type = "unknown";

  let score = 40;


  // 垃圾事件过滤

  const noiseKeywords = [
    "dota",
    "roboschool",
    "universe",
    "distill",
    "tutorial",
    "course",
    "workshop",
    "benchmark",
    "paper",
    "survey"
  ];


  if(
    noiseKeywords.some(
      item => text.includes(item)
    )
  ){

    return {
      type:"noise",
      score:10,
    };

  }


  // AI安全事件

  if (
    text.includes("safety") ||
    text.includes("security") ||
    text.includes("cyber") ||
    text.includes("mental health") ||
    text.includes("trust")
  ) {

    type = "safety";

    score = 82;

  }


  // AI评测事件

  else if (
    text.includes("benchmark") ||
    text.includes("swe-bench") ||
    text.includes("evaluation") ||
    text.includes("evaluate")
  ) {

    type = "evaluation";

    score = 75;

  }


  // 公司动态事件

  if (
    text.includes("appointed") ||
    text.includes("appoint") ||
    text.includes("joins") ||
    text.includes("chief") ||
    text.includes("ceo") ||
    text.includes("cfo") ||
    text.includes("officer")
  ) {

    type = "company";

    score = 72;

  }


  // AI研究事件

  else if (
    text.includes("paper") ||
    text.includes("arxiv") ||
    text.includes("algorithm") ||
    text.includes("mathematics") ||
    text.includes("physics") ||
    text.includes("theorem") ||
    text.includes("instruction") ||
    text.includes("hierarchy") ||
    text.includes("alignment") ||
    text.includes("training")
  ) {

    type = "research";

    score = 60;

  }


  // Agent智能体事件

  if (
    text.includes("agent") ||
    text.includes("agentic") ||
    text.includes("copilot") ||
    text.includes("codex") ||
    text.includes("operator") ||
    text.includes("runtime") ||
    text.includes("workflow")
  ) {

    type = "agent";

    score = 88;

  }


  // 模型事件

  else if (
    text.includes("gpt") ||
    text.includes("claude") ||
    text.includes("gemini") ||
    text.includes("llama") ||
    text.includes("deepseek") ||
    text.includes("模型")
  ) {

    type = "model";

    score = 85;

  }


  // 产品发布

  if (
    text.includes("launch") ||
    text.includes("release") ||
    text.includes("introducing") ||
    text.includes("announcing") ||
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
    text.includes("nvidia") ||
    text.includes("deepseek") ||
    text.includes("百度") ||
    text.includes("腾讯") ||
    text.includes("阿里") ||
    text.includes("华为") ||
    text.includes("字节") ||
    text.includes("豆包") ||
    text.includes("minimax") ||
    text.includes("月之暗面") ||
    text.includes("公司")
  ) {
    type = "company";

    score = 80;
  }

  // 安全治理

  else if (
    text.includes("安全") ||
    text.includes("safety") ||
    text.includes("governance") ||
    text.includes("治理") ||
    text.includes("risk") ||
    text.includes("threat") ||
    text.includes("early warning")
  ) {

    type = "safety";

    score = 82;

  }


  // 公司合作

  else if (
    text.includes("partnership") ||
    text.includes("partner") ||
    text.includes("合作") ||
    text.includes("api")
  ) {

    type = "company";

    score = 78;

  }


  // AI应用

  else if (
    text.includes("health") ||
    text.includes("customer") ||
    text.includes("solution") ||
    text.includes("application")
  ) {

    type = "application";

    score = 75;

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
    text.includes("transformer")
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
