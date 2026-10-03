import { News } from "@prisma/client";



/**
 * V7.4.8.10.5.5.6
 *
 * AI事件趋势预测引擎
 */



export function calculateGrowthRate(
  news: News[]
){


  const now =
    Date.now();



  const last24Hours =
    news.filter(item=>{


      const time =
        new Date(
          item.createdAt
        ).getTime();


      return (
        now-time
        <
        24*60*60*1000
      );


    }).length;




  const last72Hours =
    news.filter(item=>{


      const time =
        new Date(
          item.createdAt
        ).getTime();


      return (
        now-time
        <
        72*60*60*1000
      );


    }).length;



  if(last72Hours===0){

    return 0;

  }



  return Math.round(

    (
      last24Hours /
      last72Hours
    )
    *
    100

  );


}





export function predictEventTrend(
  news:News[]
){


const growth =
calculateGrowthRate(news);



let status =
"stable";


let prediction =
"事件保持正常关注度";




if(growth>=60){


status="exploding";


prediction=
"事件正在快速升温，可能形成热点";


}



else if(growth>=30){


status="rising";


prediction=
"事件关注度持续增长";



}


else if(growth<15){


status="falling";


prediction=
"事件热度正在下降";


}




return {


growth,


status,


prediction


};


}