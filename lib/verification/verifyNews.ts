import type { NewsItem } from "@/types/news";


import {
  matchSource
} from "./sourceMatcher";


import {
  crossCheckNews
} from "./crossCheck";


import {
  calculateConsensusScore
} from "./consensusScore";





export type VerificationStatus =

  | "verified"

  | "warning"

  | "failed";







export interface VerifyResult {


  verified:boolean;


  trustScore:number;


  verificationStatus:VerificationStatus;



  reasons:string[];


  riskFlags:string[];



  sourcesChecked:number;


  matchedSources:string[];


  conflictingSources:string[];



  sourceLevel:string;


  consensusScore:number;



}









function normalizeText(

value:unknown

):string{


if(typeof value!=="string"){

return "";

}


return value.trim();


}







function hasEnoughContent(

content:string

):boolean{


return content.length>=100;


}








function containsPublicationSignal(

text:string

):boolean{


const signals=[


"发布",


"上线",


"推出",


"宣布",


"正式发布",


"正式上线",


"launched",


"release",


"announced"


];



return signals.some(signal=>

text.toLowerCase()

.includes(

signal.toLowerCase()

)

);


}







function checkUrl(

url:string

):boolean{


if(!url){

return false;

}



try{


new URL(url);


return true;


}

catch{


return false;


}



}









export function verifyNews(

news:NewsItem

):NewsItem & VerifyResult {





const title =

normalizeText(news.title);



const content =

normalizeText(news.content);



const source =

normalizeText(news.source);



const url =

normalizeText(news.url);







let baseScore = 50;





const reasons:string[]=[];


const riskFlags:string[]=[];







/*
==========================
1. 基础真实性检测
==========================
*/



if(source){


reasons.push(

"新闻来源存在"

);


}

else{


baseScore-=15;


riskFlags.push(

"SOURCE_MISSING"

);


}








if(hasEnoughContent(content)){


baseScore+=10;


reasons.push(

"新闻内容完整"

);


}

else{


riskFlags.push(

"CONTENT_SHORT"

);


}








if(

containsPublicationSignal(

`${title} ${content}`

)

){


baseScore+=10;


reasons.push(

"包含明确事件信号"

);


}

else{


riskFlags.push(

"EVENT_SIGNAL_WEAK"

);


}








if(checkUrl(url)){


baseScore+=5;


reasons.push(

"包含有效来源链接"

);


}

else{


riskFlags.push(

"URL_INVALID"

);


}








if(title.length>=8){


reasons.push(

"标题完整"

);


}

else{


baseScore-=5;


riskFlags.push(

"TITLE_SHORT"

);


}








baseScore=Math.max(

0,

Math.min(

100,

baseScore

)

);









/*
==========================
2. 来源可信分析
==========================
*/



const sourceResult =

matchSource(source);







reasons.push(

sourceResult.reason

);









/*
==========================
3. 多源交叉验证
==========================
*/



const crossResult =

crossCheckNews(

[news]

);







reasons.push(

crossResult.reason

);









/*
==========================
4. 综合可信评分
==========================
*/



const consensus =

calculateConsensusScore(

baseScore,

sourceResult,

crossResult

);









const finalScore =

consensus.finalScore;








let verificationStatus:

VerificationStatus;





if(finalScore>=85){


verificationStatus="verified";


}

else if(finalScore>=60){


verificationStatus="warning";


}

else{


verificationStatus="failed";


}







return {


...news,



verified:

verificationStatus==="verified",



trustScore:

finalScore,



verificationStatus,



reasons:[

...reasons,

...consensus.explanation

],



riskFlags,



sourcesChecked:

crossResult.sourcesChecked,



matchedSources:

crossResult.matchedSources,



conflictingSources:

crossResult.conflictingSources,



sourceLevel:

sourceResult.level,



consensusScore:

consensus.finalScore



};



}