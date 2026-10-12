export interface ContentQualityResult {

    score:number;

    level:
        | "normal"
        | "warning"
        | "polluted";

    reasons:string[];

}



export function checkContentQuality(
    content:string
):ContentQualityResult{


    let score = 0;

    const reasons:string[]=[];



    if(!content || !content.trim()){

        return {
            score:100,
            level:"polluted",
            reasons:["empty_content"]
        };

    }



    const text = content.toLowerCase();



    const rules = [

        ["<script",30,"script"],
        ["datalayer",25,"analytics_code"],
        ["window.",25,"javascript"],
        ["document.",25,"javascript"],

        ["@media",30,"css"],
        ["{position:",25,"css_block"],
        ["{display:",20,"css_block"],
        ["{width:",15,"css_block"],
        ["!important",15,"css"],

        ["const ",8,"javascript"],
        ["var ",8,"javascript"],
        ["let ",3,"javascript"],
        ["=>",3,"javascript"],

        ["csslist",25,"page_config"],
        ["siteinfo",25,"page_config"],
        ["aiocdn",25,"page_config"],
        ["cnpm-pep",30,"huaweicloud_component"],
        ["res.hc-cdn.com",30,"cdn_resource"],

        ["联系我们",5,"navigation"],
        ["关于我们",5,"navigation"],
        ["加入我们",5,"navigation"],
        ["投资者关系",5,"navigation"],
        ["下载",3,"navigation"],
        ["登录",3,"navigation"],
        ["注册",3,"navigation"],

        ["ICP备",10,"copyright"],
        ["copyright",10,"copyright"]

    ];



    for(const rule of rules){

        const word = rule[0] as string;
        const value = rule[1] as number;
        const reason = rule[2] as string;


        if(text.includes(word.toLowerCase())){

            score += value;
            reasons.push(reason);

        }

    }



    const resourceCount =
        (text.match(/https?:\/\//g) || []).length;


    if(resourceCount >=5){

        score +=30;

        reasons.push(
            "too_many_resources"
        );

    }



    if(content.length < 80){

        score +=10;

        reasons.push(
            "too_short"
        );

    }



    if(content.length > 200){

        const symbolRate =
            (content.match(/[{}[\]();_=]/g) || []).length /
            content.length;


        if(symbolRate > 0.08){

            score +=25;

            reasons.push(
                "code_density"
            );

        }

    }



    let level:
        | "normal"
        | "warning"
        | "polluted";



    if(score >=40){

        level="polluted";

    }
    else if(score >=15){

        level="warning";

    }
    else{

        level="normal";

    }



    return {

        score,

        level,

        reasons

    };

}
