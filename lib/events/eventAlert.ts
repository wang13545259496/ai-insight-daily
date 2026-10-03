import { NewsEvent } from "@prisma/client";



/**
 * V7.4.8.10.5.5.7
 *
 * AI事件预警分析器
 */



export type AlertLevel =
  | "exploding"
  | "hot"
  | "normal"
  | "cooling";





export function analyzeEventAlert(
  event: NewsEvent
){



let level:AlertLevel =
"normal";



let message =
"事件保持正常关注度";





if(
event.heatScore >= 500
){


level="exploding";


message =
"🔥 事件热度爆发，建议重点关注";


}

else if(
event.heatScore >=300
){


level="hot";


message =
"📈 事件快速升温，正在形成热点";


}

else if(
event.trendStatus==="falling"
){


level="cooling";


message =
"📉 事件关注度下降";


}





return {


level,


message,


priority:


level==="exploding"
?
100
:
level==="hot"
?
70
:
level==="cooling"
?
30
:
10


};


}