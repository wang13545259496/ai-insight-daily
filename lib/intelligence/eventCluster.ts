import { prisma } from "@/lib/prisma";



function isValidNewsForEvent(title:string){

  const text = title.trim();


  const badWords=[

    "Sina Visitor System",
    "Visitor System",
    "Welcome",
    "登录",
    "Login",
    "首页",
    "联系我们",
    "AI Agent",
    "OpenAI生态",
    "AI产业应用",
    "AI安全治理",
    "大模型竞争"

  ];


  if(
    badWords.some(
      item=>text.includes(item)
    )
  ){

    return false;

  }


  if(text.length < 8){

    return false;

  }


  const onlyTags=[

    /^AI\s?Agent$/i,
    /^AI$/,
    /^Agent$/i,
    /^.*生态$/,
    /^.*竞争$/,
    /^.*应用$/,
    /^.*治理$/

  ];


  if(
    onlyTags.some(
      rule=>rule.test(text)
    )
  ){

    return false;

  }


  return true;

}




const EVENT_TOPICS = [

  {
    name:"OpenAI生态",
    keywords:[
      "openai",
      "chatgpt",
      "gpt",
      "codex"
    ]
  },

  {
    name:"AI Agent",
    keywords:[
      "agent",
      "agentic",
      "智能体",
      "computer use"
    ]
  },

  {
    name:"大模型竞争",
    keywords:[
      "model",
      "模型",
      "claude",
      "gemini",
      "llama",
      "deepseek"
    ]
  },

  {
    name:"AI安全治理",
    keywords:[
      "safety",
      "cyber",
      "安全",
      "policy"
    ]
  },

  {
    name:"AI产业应用",
    keywords:[
      "enterprise",
      "business",
      "company",
      "deployment",
      "企业"
    ]
  }

];


function detectTopic(text:string){

  const t=text.toLowerCase();

  const topicRules=[

    {
      name:"OpenAI生态",
      keywords:[
        "openai",
        "chatgpt",
        "gpt",
        "sora",
        "dall",
        "operator",
        "fine-tuning",
        "human feedback",
        "ai progress",
        "third party assessments",
        "unconference",
        "magic studio",
        "multilingual influence",
        "influence activity"
      ]
    },

    {
      name:"AI Agent",
      keywords:[
        "agent",
        "智能体",
        "operator"
      ]
    },

    {
      name:"大模型竞争",
      keywords:[
        "gemini",
        "claude",
        "llama",
        "frontier model",
        "大模型",
        "foundation model"
      ]
    },

    {
      name:"AI安全治理",
      keywords:[
        "safety",
        "security",
        "alignment",
        "治理",
        "assessment"
      ]
    },

    {
      name:"AI基础设施演进",
      keywords:[
        "chip",
        "gpu",
        "infrastructure",
        "infra",
        "cuda"
      ]
    }

  ];

  for(const rule of topicRules){

    if(
      rule.keywords.some(
        k=>t.includes(k.toLowerCase())
      )
    ){
      return rule.name;
    }

  }

  return null;

}



const COMPANY_ENTITIES = [
  "OpenAI",
  "Google",
  "DeepMind",
  "Microsoft",
  "Anthropic",
  "NVIDIA",
  "Meta",
  "DeepSeek",
  "百度",
  "腾讯",
  "阿里",
  "华为",
  "字节",
  "豆包",
  "月之暗面",
  "MiniMax",
  "智谱",
];

function extractCompanies(text:string){

  const result:string[] = [];

  for(const company of COMPANY_ENTITIES){

    if(text.toLowerCase().includes(company.toLowerCase())){

      result.push(company);

    }

  }

  return result;

}


function entitySimilarity(a:string,b:string){

  const aCompanies = extractCompanies(a);

  const bCompanies = extractCompanies(b);


  if(!aCompanies.length || !bCompanies.length){

    return 0;

  }


  return aCompanies.some(
    item=>bCompanies.includes(item)
  )
  ? 0.15
  : 0;

}


function normalizeText(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[，。！？、,.!?：:；;（）()【】[\]"'“”‘’\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  const normalized = normalizeText(text);

  const latin = normalized
    .split(/\s+/)
    .filter((item) => item.length >= 2);

  const chinese = Array.from(normalized)
    .filter((char) => /[\u4e00-\u9fff]/.test(char));

  const bigrams: string[] = [];

  for (let i = 0; i < chinese.length - 1; i++) {
    bigrams.push(chinese[i] + chinese[i + 1]);
  }

  return Array.from(new Set([...latin, ...bigrams]));
}

function similarity(a: string, b: string) {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);

  if (!aTokens.length || !bTokens.length) return 0;

  const bSet = new Set(bTokens);
  let same = 0;

  for (const token of aTokens) {
    if (bSet.has(token)) same++;
  }

  return same / Math.max(aTokens.length, bTokens.length);
}

function extractKeywords(title: string) {
  return tokenize(title)
    .slice(0, 12)
    .join(",");
}

export async function buildEventClusters() {
  const news = await prisma.news.findMany({
    where: {
      eventId: null,
      dataStatus: "active",
      publishedAt:{
        gte:new Date(
          Date.now()-30*24*60*60*1000
        )
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 500,
  });

  const validNews =
    news.filter(
      item =>
        isValidNewsForEvent(
          item.title
        )
    );


  if (!validNews.length) {
    return {
      events: 0,
      news: 0,
      linked: 0,
    };
  }

  const eventLimitDate = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  );

  const events = await prisma.newsEvent.findMany({
    where: {
      status: "active",
      updatedAt: {
        gte: eventLimitDate,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 200,
  });

  let linked = 0;
  let created = 0;

  for (const item of validNews) {
    let bestEvent: typeof events[number] | null = null;
    let bestScore = 0;

    for (const event of events) {
      const baseScore = Math.max(
        similarity(item.title, event.title),
        similarity(item.title, event.keywords)
      );

      const companyScore = entitySimilarity(
        item.title,
        event.title
      );

      const score = Math.min(
        1,
        baseScore + companyScore
      );

      if (score > bestScore) {
        bestScore = score;
        bestEvent = event;
      }
    }

    if (bestEvent && bestScore >= 0.45) {
      await prisma.news.update({
        where: { id: item.id },
        data: {
          eventId: bestEvent.id,
        },
      });

      linked++;
      continue;
    }

    const topic =
      detectTopic(item.title);


    if(topic){

      const topicEvent =
      await prisma.newsEvent.findFirst({

        where:{
          title:topic,
          status:"active"
        }

      });


      if(topicEvent){

        await prisma.news.update({

          where:{
            id:item.id
          },

          data:{
            eventId:topicEvent.id
          }

        });


        linked++;

        continue;

      }


      const companyTopic =
        /openai|chatgpt|operator|dall·e|dalle|codex|gpt|anthropic|claude|gemini|deepmind|nvidia|microsoft|meta/i.test(item.title);


      if(companyTopic){

        const companyEvent =
          await prisma.newsEvent.findFirst({
            where:{
              title:{
                in:[
                  "OpenAI生态",
                  "大模型竞争"
                ]
              },
              status:"active"
            }
          });


        if(companyEvent){

          await prisma.news.update({

            where:{
              id:item.id
            },

            data:{
              eventId:companyEvent.id
            }

          });


          linked++;

          continue;

        }

      }

    }


    const standaloneSignals = [
      "融资",
      "收购",
      "并购",
      "估值",
      "投资",
      "战略合作",
      "重大合作",
      "openai",
      "anthropic",
      "google",
      "deepmind",
      "nvidia",
      "microsoft",
      "meta",
      "deepseek",
      "百度",
      "腾讯",
      "阿里",
      "华为",
      "模型",
      "大模型",
      "agent",
      "智能体",
      "芯片",
      "gpu"
    ];

    const allowStandalone =
      standaloneSignals.some(
        k => item.title.toLowerCase().includes(k.toLowerCase())
      );

    if(!allowStandalone){
      continue;
    }


    const event = await prisma.newsEvent.create({
      data: {
        title:
        detectTopic(item.title)
        ?
        detectTopic(item.title)!
        :
        item.title,
        keywords: extractKeywords(item.title),
        category: item.category,
        summary:
          `围绕“${item.title}”形成的AI产业事件。系统将持续聚合相关来源并跟踪后续发展。`,
        heatScore: Math.min(
          100,
          30 +
          Math.min(40, (item.sourceCount ?? 1) * 10) +
          (item.verified ? 20 : 0)
        ),
        peakScore: Math.min(
          100,
          30 +
          Math.min(40, (item.sourceCount ?? 1) * 10) +
          (item.verified ? 20 : 0)
        ),
        trendStatus: "rising",
        trendSummary: "新事件进入监测阶段。",
        eventType: "news",
        qualityScore: Math.min(
          100,
          40 +
            (item.verified ? 20 : 0) +
            Math.min(30, (item.sourceCount ?? 1) * 10)
        ),
      },
    });

    await prisma.news.update({
      where: { id: item.id },
      data: {
        eventId: event.id,
      },
    });

    events.push(event);
    created++;
  }

  return {
    events: created,
    news: news.length,
    linked,
  };
}
