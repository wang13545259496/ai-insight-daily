export interface NewsTypeResult {

    type:
        | "news"
        | "company_page"
        | "product_page";

    score:number;

    reasons:string[];

}



export function classifyNewsType(

    title:string,

    content:string

):NewsTypeResult{


    let score = 0;

    const reasons:string[]=[];


    const text =
        `${title} ${content}`;



    // 官网导航特征

    const navigationWords = [

        "关于我们",
        "加入我们",
        "联系我们",
        "商业生态",
        "解决方案",
        "合作咨询",
        "登录",
        "注册",
        "下载"

    ];



    let navigationCount = 0;


    for(const word of navigationWords){


        if(text.includes(word)){

            navigationCount++;

            reasons.push(
                `navigation:${word}`
            );

        }

    }



    if(navigationCount >=3){

        score +=30;

    }



    // 产品列表特征

    const productWords = [

        "模型",
        "API",
        "平台",
        "产品",
        "服务",
        "套餐",
        "开发者"

    ];



    let productCount = 0;


    for(const word of productWords){


        if(text.includes(word)){

            productCount++;

        }

    }



    if(productCount >=5){

        score +=25;

        reasons.push(
            "product_density"
        );

    }



    // 新闻事件词

    const eventWords = [

        "发布",
        "推出",
        "宣布",
        "上线",
        "更新",
        "获得",
        "完成",
        "合作",
        "收购",
        "融资"

    ];



    let eventCount = 0;


    for(const word of eventWords){


        if(text.includes(word)){

            eventCount++;

        }

    }



    if(eventCount >=1){

        score -=20;

        reasons.push(
            "has_event"
        );

    }



    // 标题过短

    if(title.length <=8){

        score +=15;

        reasons.push(
            "short_title"
        );

    }



    let type:
        | "news"
        | "company_page"
        | "product_page";



    if(score >=50){

        type="company_page";

    }
    else if(score >=30){

        type="product_page";

    }
    else{

        type="news";

    }



    return {

        type,

        score,

        reasons

    };


}
