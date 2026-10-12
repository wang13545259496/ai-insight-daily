import type { } from "@prisma/client";


export function calculateQualityScore(
    source:string,
    title:string,
    content:string
){

    let score = 0;


    const officialSources = [

        "OpenAI",
        "Google",
        "Microsoft",
        "Anthropic",
        "DeepMind",
        "Meta",
        "NVIDIA",
        "DeepSeek",
        "百度",
        "腾讯",
        "阿里",
        "华为",
        "字节",
        "智谱",
        "MiniMax",
        "月之暗面",
        "阶跃"

    ];


    if(
        officialSources.some(
            item=>source.includes(item)
        )
    ){

        score +=30;

    }



    const highValueKeywords=[


        "GPT",
        "Claude",
        "Gemini",
        "DeepSeek",
        "Qwen",
        "Llama",
        "模型发布",
        "大模型",
        "System Card",
        "Agent",
        "智能体",
        "Operator",
        "Codex",
        "Computer Use",
        "机器人",
        "芯片",
        "GPU",
        "融资",
        "收购",
        "合作",
        "企业部署"


    ];



    for(const word of highValueKeywords){

        if(
            title.includes(word) ||
            content.includes(word)
        ){

            score +=8;

        }

    }



    const lowValueKeywords=[


        "benchmark",
        "paper",
        "论文",
        "tutorial",
        "教程",
        "research agenda",
        "survey"


    ];



    for(const word of lowValueKeywords){

        if(
            title.toLowerCase().includes(word.toLowerCase())
        ){

            score -=10;

        }

    }



    if(content.length>800){

        score +=20;

    }
    else if(content.length>300){

        score +=10;

    }



    if(title.length>=12){

        score +=10;

    }



    return Math.max(
        0,
        Math.min(score,100)
    );

}



export function shouldAcceptNews(

title:string,

content:string,

score:number

){


    if(!title){

        return false;

    }



    if(title.length<5){

        return false;

    }



    if(score>=55){

        return true;

    }



    if(
        content.length>300 &&
        score>=45
    ){

        return true;

    }



    return false;


}
