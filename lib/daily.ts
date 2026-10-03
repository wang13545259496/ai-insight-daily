import {
verifyNews
} from "./verify";


import {
cleanNews
} from "./clean";


import {
summarizeNews
} from "./summarize";



export interface DailyNews {


id:number;

title:string;

time:string;

background:string;

content:string;

source:string;

score:number;

tags:string[];

}



interface NewsInput {
  title:string;
  content:string;
  source:string;
  time:string;
}
export function generateDaily(
newsList:NewsInput[]
):DailyNews[]{



return newsList

.map((item,index)=>{


//真实性检测

const verify =
verifyNews(
item.source,
item.content
);



//清洗

const clean =
cleanNews(
item.title,
item.content
);



//摘要

const summary =
summarizeNews(
clean.content
);



return {


id:index+1,


title:
clean.title,


time:
item.time,


background:
summary.background,


content:
summary.summary,


source:
item.source,


score:
verify.score,


tags:
clean.tags


};


})


//按照可信度排序

.sort(
(a,b)=>
b.score-a.score
)


//每天精选8条

.slice(0,8);



}