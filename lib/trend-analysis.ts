import { prisma } from "@/lib/prisma";



function calculateScore(

  text:string,

  keywords:string[]

){


  let score = 0;



  keywords.forEach(word=>{


    if(

      text.toLowerCase()

      .includes(

        word.toLowerCase()

      )

    ){

      score++;

    }


  });



  return score;


}






export async function getTrendAnalysis(){



  const news =

    await prisma.news.findMany({

      orderBy:{

        createdAt:"desc"

      },


      take:100


    });





  let model = 0;

  let agent = 0;

  let robot = 0;

  let startup = 0;





  news.forEach(item=>{


    const text =

      item.title +

      item.summary +

      item.content;





    model += calculateScore(

      text,

      [

        "GPT",

        "LLM",

        "模型",

        "大模型",

        "Claude",

        "Gemini"

      ]

    );





    agent += calculateScore(

      text,

      [

        "Agent",

        "智能体",

        "自动化",

        "工作流"

      ]

    );





    robot += calculateScore(

      text,

      [

        "机器人",

        "Robot",

        "具身智能"

      ]

    );





    startup += calculateScore(

      text,

      [

        "融资",

        "创业",

        "投资",

        "公司"

      ]

    );



  });







  function level(score:number){


    if(score >= 20)

      return 5;


    if(score >= 10)

      return 4;


    if(score >= 5)

      return 3;


    if(score >= 2)

      return 2;


    return 1;


  }






  return {


    model:level(model),

    agent:level(agent),

    robot:level(robot),

    startup:level(startup)


  };

}