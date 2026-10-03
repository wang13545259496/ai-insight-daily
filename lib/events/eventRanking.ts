import { NewsEvent } from "@prisma/client";



/**
 * V7.4.8.10.5.5.5
 *
 * AI事件排序引擎
 */



export function calculateRankingScore(
  event: NewsEvent
){


  let score =
    event.heatScore;



  // 趋势加权

  if(
    event.trendStatus==="rising"
  ){

    score += 50;

  }



  if(
    event.trendStatus==="stable"
  ){

    score += 20;

  }




  // 爆发事件额外权重

  if(
    event.heatScore>=300
  ){

    score += 100;

  }



  return score;


}





export function sortEventsByHot(
  events:NewsEvent[]
){


return events.sort(
  (a,b)=>{


    return (

      calculateRankingScore(b)
      -
      calculateRankingScore(a)

    );


  }
);


}