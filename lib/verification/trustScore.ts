export function calculateTrustScore(

news:{

source:string;

type:string;

content:string;

trust:number;

}

){



let score = news.trust;



// 官方来源加权

if(

news.type === "official"

){

score += 10;

}



// 内容完整度

if(

news.content.length > 100

){

score += 10;

}



// 内容过短降低可信度

if(

news.content.length < 30

){

score -= 20;

}



// 最大100

if(score>100){

score=100;

}



// 最小0

if(score<0){

score=0;

}



return score;


}