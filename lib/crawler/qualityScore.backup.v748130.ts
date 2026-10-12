export function calculateQualityScore(
    source:string,
    title:string,
    content:string
){

    let score = 0;


    const text =
        `${title} ${content}`.toLowerCase();



    const officialSources=[

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

        score +=25;

    }



    const importantKeywords=[


        "gpt",
        "claude",
        "gemini",
        "deepseek",
        "qwen",
        "llama",
        "大模型",
        "模型发布",
        "agent",
        "智能体",
        "operator",
        "codex",
        "computer use",
        "机器人",
        "gpu",
        "芯片",
        "融资",
        "收购",
        "合作",
        "企业部署",
        "产品发布"


    ];



    for(const word of importantKeywords){

        if(text.includes(word.toLowerCase())){

            score +=6;

        }

    }



    if(content.length>1000){

        score+=20;

    }
    else if(content.length>500){

        score+=12;

    }
    else if(content.length>200){

        score+=5;

    }



    if(title.length>=10){

        score+=10;

    }



    // 新闻型标题奖励

    const newsWords=[

        "发布",
        "推出",
        "上线",
        "宣布",
        "升级",
        "获得",
        "合作",
        "推出",
        "开源"

    ];



    if(
        newsWords.some(
            w=>title.includes(w)
        )
    ){

        score+=10;

    }



    return Math.max(
        0,
        Math.min(
            score,
            100
        )
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



    const cleanTitle =
        title.trim();



    if(cleanTitle.length<5){

        return false;

    }



    const badTitles=[

        "首页",
        "微博-随时随地发现新鲜事",
        "登录",
        "注册",
        "404",
        "Not Found"

    ];



    if(
        badTitles.some(
            item=>cleanTitle.includes(item)
        )
    ){

        return false;

    }



    // 正常新闻进入

    if(score>=45){

        return true;

    }



    // 有正文也允许观察

    if(
        content.length>300 &&
        score>=35
    ){

        return true;

    }



    return false;

}
