export interface VerifyResult {

    score:number;

    status:
    | "verified"
    | "warning"
    | "failed";

    reasons:string[];

}



export function verifyNews(
source:string,
content:string
):VerifyResult{


let score = 50;

const reasons:string[]=[];


// 官方来源检测

const officialSources=[

"OpenAI",
"Google",
"Microsoft",
"Anthropic",
"百度",
"腾讯"

];


if(
officialSources.some(
item=>source.includes(item)
)
){

score+=40;

reasons.push(
"官方来源"
);

}



// 内容长度检测

if(content.length>100){

score+=10;

reasons.push(
"内容信息完整"
);

}



// 模拟多源验证

if(
content.includes("发布")
||
content.includes("上线")
){

score+=10;

reasons.push(
"包含明确事件描述"
);

}




let status:
"verified"
|"warning"
|"failed";


if(score>=80){

status="verified";

}
else if(score>=60){

status="warning";

}
else{

status="failed";

}



return {

score,

status,

reasons

};


}