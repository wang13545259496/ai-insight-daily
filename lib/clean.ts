export interface CleanNews {


title:string;

content:string;

tags:string[];

}



export function cleanNews(
title:string,
content:string
):CleanNews{


// 去除多余空格

const cleanContent =
content
.replace(/\s+/g," ")
.trim();



// 标题优化

const cleanTitle =
title.trim();



// 自动标签

const tags:string[]=[];



const keywords=[

{
key:"OpenAI",
tag:"OpenAI"
},

{
key:"GPT",
tag:"大模型"
},

{
key:"Agent",
tag:"AI智能体"
},

{
key:"模型",
tag:"AI模型"
},

{
key:"机器人",
tag:"机器人"
},

{
key:"芯片",
tag:"AI芯片"
}

];



keywords.forEach(item=>{


if(
cleanContent.includes(item.key)
||
cleanTitle.includes(item.key)
){

tags.push(item.tag);

}


});



// 没有标签默认

if(tags.length===0){

tags.push(
"人工智能"
);

}



return {


title:cleanTitle,

content:cleanContent,

tags


};


}