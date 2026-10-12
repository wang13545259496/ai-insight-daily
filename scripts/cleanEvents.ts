import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


function isBadEvent(
  title:string,
  eventType:string,
  qualityScore:number
){

  const text =
  title.toLowerCase();


  const badWords = [

    "sina visitor system",
    "visitor system",
    "登录",
    "login",
    "首页",
    "welcome",
    "联系我们",
    "官网",
    "ai助手",
    "dota",
    "roboschool",
    "tutorial",
    "workshop",
    "benchmark",
    "distill"

  ];


  if(
    badWords.some(
      item=>text.includes(item)
    )
  ){

    return true;

  }


  const keepWords=[

    "openai",
    "google",
    "deepmind",
    "microsoft",
    "anthropic",
    "nvidia",
    "meta",
    "deepseek",
    "百度",
    "腾讯",
    "阿里",
    "华为",
    "字节",
    "豆包",
    "minimax",
    "月之暗面",
    "发布",
    "launch",
    "release",
    "introducing",
    "announcing",
    "partner",
    "partnership",
    "fund",
    "investment",
    "agent",
    "copilot",
    "model",
    "gpt",
    "claude",
    "gemini",
    "llm",
    "安全",
    "治理",
    "enterprise",
    "business"

  ];


  const hasIndustrySignal =
  keepWords.some(
    item=>text.includes(item)
  );


  if(!hasIndustrySignal){

    return true;

  }


  if(
    eventType==="noise"
  ){

    return true;

  }


  if(
    qualityScore < 30
  ){

    return true;

  }


  return false;

}



async function main(){


console.log(
"开始V7事件质量清洗..."
);



const events =
await prisma.newsEvent.findMany({

include:{
news:true
}

});



let removed=0;



for(
const event of events
){


const bad =
isBadEvent(

event.title,

event.eventType || "",

event.qualityScore || 0

);



if(!bad){

continue;

}



await prisma.news.updateMany({

where:{
eventId:event.id
},

data:{
eventId:null
}

});



await prisma.newsEvent.delete({

where:{
id:event.id
}

});



removed++;


console.log(
"删除低质量事件:",
event.title,
"类型:",
event.eventType,
"质量:",
event.qualityScore
);


}



console.log(

`事件质量清洗完成 删除:${removed}`

);


}



main()

.catch(error=>{

console.error(error);

process.exit(1);

})

.finally(async()=>{

await prisma.$disconnect();

});
