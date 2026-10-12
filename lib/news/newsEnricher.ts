export interface EnrichedNews {

    content:string;

    summary:string;

    background:string;

    impact:string;

    businessOpportunity:string;

}



function detectTopic(title:string){

    const text =
        title.toLowerCase();


    if(
        text.includes("agent") ||
        text.includes("智能体")
    ){

        return "AI智能体生态";

    }


    if(
        text.includes("模型") ||
        text.includes("gpt") ||
        text.includes("claude") ||
        text.includes("gemini")
    ){

        return "AI基础模型";

    }


    if(
        text.includes("芯片") ||
        text.includes("gpu")
    ){

        return "AI基础设施";

    }


    if(
        text.includes("机器人")
    ){

        return "AI机器人";

    }


    return "人工智能产业";

}



export function enrichNews(

    title:string,

    content:string

):EnrichedNews{


    const topic =
        detectTopic(title);



    const short =
        content.trim().length < 120;



    if(!short){

        return {

            content,

            summary:
                content.slice(0,180),

            background:
                `该新闻属于${topic}方向，涉及人工智能产业最新发展动态。`,

            impact:
                `该进展可能影响${topic}相关企业、开发者生态以及行业应用布局。`,

            businessOpportunity:
                `围绕${topic}方向，企业可关注技术服务、应用落地和商业化机会。`

        };

    }



    const enhancedContent =

`${title}

${content}

背景：

${topic}正在成为人工智能产业的重要发展方向。
相关企业持续推进技术升级、产品优化和商业应用探索。

影响：

该动态将推动${topic}领域竞争加速，
并影响未来AI产品、企业服务以及产业生态布局。

商业机会：

围绕${topic}，
开发工具、行业应用、企业解决方案以及生态服务
可能形成新的商业增长空间。`;



    return {


        content:
            enhancedContent,


        summary:
            `${title}：${content}`,


        background:
            `${topic}领域持续发展，相关技术和应用正在快速演进。`,


        impact:
            `该事件可能推动${topic}产业竞争和应用落地。`,


        businessOpportunity:
            `关注${topic}相关商业化机会。`

    };


}
