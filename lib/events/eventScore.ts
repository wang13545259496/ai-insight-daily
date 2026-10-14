import { News } from "@prisma/client";


function getNewsTime(item: News){

  return (
    item.publishedAt ??
    item.createdAt
  );

}



function isOfficialSource(source:string){

  const official=[

    "OpenAI",
    "Google",
    "Microsoft",
    "Anthropic",
    "NVIDIA",
    "DeepMind",
    "百度",
    "腾讯",
    "阿里",
    "华为",
    "字节"

  ];


  return official.some(
    item =>
      source.includes(item)
  );

}




export function calculateEventScore(
  news: News[]
){

  if(!news.length){

    return 0;

  }



  /*
   新闻规模
  */

  const newsScore =
    Math.min(
      news.length * 8,
      250
    );



  /*
   多来源验证
  */

  const sourceCount =
    new Set(
      news.map(
        item=>item.source
      )
    ).size;


  const sourceScore =
    Math.min(
      sourceCount * 20,
      200
    );




  /*
    发布时间增长
  */

  const now =
    Date.now();


  const recent24 =
    news.filter(item=>{

      const time =
        new Date(
          getNewsTime(item)
        ).getTime();


      return (
        now-time
        <=
        24*60*60*1000
      );

    });



  const growthScore =
    Math.min(
      recent24.length * 25,
      250
    );




  /*
    AI质量
  */


  const avgAiScore =
    news.reduce(
      (
        sum,
        item
      )=>
        sum+
        (item.aiScore || 0),
      0
    )
    /
    news.length;



  const qualityScore =
    Math.round(
      avgAiScore * 2
    );




  /*
    官方来源增强
  */


  const officialScore =
    news.some(
      item=>
        isOfficialSource(
          item.source
        )
    )
    ?
    100
    :
    0;




  const total =

    newsScore
    +
    sourceScore
    +
    growthScore
    +
    qualityScore
    +
    officialScore;



  return Math.min(
    Math.round(total),
    1000
  );


}







export function calculateTrendStatus(
  score:number
){


  if(score>=400){

    return "rising";

  }


  if(score>=150){

    return "stable";

  }


  return "falling";

}






export function generateTrendSummary(
 score:number
){

  if(score>=400){

    return "重大AI产业事件，多来源快速扩散，建议重点跟踪";

  }


  if(score>=150){

    return "产业影响持续释放，建议持续跟踪后续发展";

  }


  if(score>=50){

    return "事件保持行业关注，持续观察产业进展";

  }


  return "事件进入稳定观察阶段";

}
