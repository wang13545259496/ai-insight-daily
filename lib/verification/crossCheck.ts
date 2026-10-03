import type { NewsItem } from "@/types/news";



export interface CrossCheckResult {


  sourcesChecked:number;


  matchedSources:string[];


  conflictingSources:string[];


  consistencyScore:number;


  reason:string;


}





/**
 * 简单文本相似度判断
 *
 * V7.4.6.4.2基础版
 *
 * 后续可接AI Embedding
 */

function calculateSimilarity(

textA:string,

textB:string

):number {



  const a =

  textA

    .toLowerCase()

    .split(/\s+/);



  const b =

  textB

    .toLowerCase()

    .split(/\s+/);




  const common =

  a.filter(word=>

    b.includes(word)

  );




  if(a.length===0){

    return 0;

  }



  return Math.round(

    common.length /

    a.length *

    100

  );


}








/**
 * 多源交叉验证
 */


export function crossCheckNews(

newsList:NewsItem[]

):CrossCheckResult {



  if(

    !newsList ||

    newsList.length===0

  ){


    return {


      sourcesChecked:0,


      matchedSources:[],


      conflictingSources:[],


      consistencyScore:0,


      reason:"没有可验证来源"


    };


  }






const sources =

newsList.map(item=>

item.source

);






const uniqueSources =

Array.from(

new Set(sources)

);








let consistencyScore = 0;





const matchedSources:string[]=[];


const conflictingSources:string[]=[];








// 单来源

if(uniqueSources.length===1){


consistencyScore=50;


matchedSources.push(

uniqueSources[0]

);



}






// 多来源

else{



for(

let i=0;

i<newsList.length;

i++

){



for(

let j=i+1;

j<newsList.length;

j++

){



const similarity =

calculateSimilarity(

newsList[i].content,

newsList[j].content

);




if(similarity>=40){



matchedSources.push(

`${newsList[i].source} + ${newsList[j].source}`

);



consistencyScore += 20;



}

else{



conflictingSources.push(

`${newsList[i].source} <> ${newsList[j].source}`

);



}


}


}



}








// 限制分数


consistencyScore = Math.min(

100,

consistencyScore

);








return {


sourcesChecked:

uniqueSources.length,


matchedSources:


Array.from(

new Set(

matchedSources

)

),



conflictingSources:


Array.from(

new Set(

conflictingSources

)

),



consistencyScore,




reason:


uniqueSources.length>=3

?

"多个独立来源交叉验证"

:

uniqueSources.length===2

?

"双来源验证"

:

"单来源信息"



};



}