import { News } from "@prisma/client";



/**
 * V7.4.8.10.5.5.3
 *
 * AI事件自动评分引擎
 */



export function calculateEventScore(
  news: News[]
){



  // 新闻数量评分

  const newsScore =
    news.length * 10;




  // 来源数量评分

  const sourceScore =
    new Set(
      news.map(
        item=>item.source
      )
    ).size * 15;





  // 时间增长评分

  const now =
    Date.now();



  const recentNews =
    news.filter(item=>{


      const diff =
        now -
        new Date(
          item.createdAt
        ).getTime();



      return (
        diff <
        24 * 60 * 60 * 1000
      );


    });




  const growthScore =
    recentNews.length * 20;





  // 关键词评分

  const keywordScore =
    Math.min(
      news.length * 5,
      100
    );




  const total =

    newsScore
    +
    sourceScore
    +
    growthScore
    +
    keywordScore;




  return Math.min(
    total,
    1000
  );


}






export function calculateTrendStatus(
  score:number
){


  if(score>=300){

    return "rising";

  }



  if(score>=100){

    return "stable";

  }



  return "falling";


}







export function generateTrendSummary(
  score:number
){


  if(score>=300){

    return "事件热度快速增长，正在形成行业关注热点";

  }



  if(score>=100){

    return "事件保持稳定关注度";

  }



  return "事件关注度正在下降";


}