import { prisma } from "@/lib/prisma";


export async function getHotNews(){


  const news =
    await prisma.news.findMany({

      orderBy:{
        createdAt:"desc"
      },

      take:50

    });



  const scored =
    news.map(item=>{


      let score = 0;



      // 发布时间权重

      const hours =

        (

          Date.now()

          -

          item.createdAt.getTime()

        )

        /

        1000

        /

        60

        /

        60;



      if(hours < 24){

        score += 50;

      }

      else if(hours < 72){

        score += 30;

      }

      else{

        score += 10;

      }




      // 来源权重

      if(

        item.source.includes("OpenAI")

        ||

        item.source.includes("Google")

        ||

        item.source.includes("Anthropic")

      ){

        score += 20;

      }



      // 标题关键词

      const title =
        item.title.toLowerCase();



      const keywords = [

        "gpt",

        "ai",

        "模型",

        "agent",

        "智能体",

        "机器人"

      ];



      keywords.forEach(word=>{


        if(title.includes(word)){

          score += 5;

        }


      });



      return {

        ...item,

        score

      };


    });



  return scored

    .sort(

      (a,b)=>

      b.score-a.score

    )

    .slice(0,5);



}