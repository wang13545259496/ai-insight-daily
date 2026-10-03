export interface NewsScore {


company:number;


technology:number;


market:number;


startup:number;


total:number;


}



export function calculateNewsScore(

news:{

source:string;

title:string;

content:string;

}

):NewsScore{



let company = 70;


let technology = 70;


let market = 70;


let startup = 70;





const text =

(

news.title +

news.content

).toLowerCase();





// 企业影响力

if(

text.includes("openai")

||

text.includes("google")

||

text.includes("microsoft")

||

text.includes("anthropic")

){

company +=20;

}




// 技术影响

if(

text.includes("model")

||

text.includes("模型")

||

text.includes("agent")

){

technology +=20;

}




// 市场价值

if(

text.includes("enterprise")

||

text.includes("企业")

||

text.includes("商业")

){

market +=15;

}




// 创业价值

if(

text.includes("agent")

||

text.includes("platform")

||

text.includes("工具")

){

startup +=20;

}




const total = Math.round(

(

company

+

technology

+

market

+

startup

)

/

4

);



return {


company,


technology,


market,


startup,


total


};


}