export interface WebNewsItem {

    title:string;

    content:string;

    url:string;

    publishedAt?:Date;

}



function cleanText(text:string){

    return (text || "")
        .replace(/<script[\s\S]*?<\/script>/gi," ")
        .replace(/<style[\s\S]*?<\/style>/gi," ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi," ")
        .replace(/<svg[\s\S]*?<\/svg>/gi," ")
        .replace(/<[^>]+>/g," ")
        .replace(/&nbsp;/gi," ")
        .replace(/&amp;/gi,"&")
        .replace(/&lt;/gi,"<")
        .replace(/&gt;/gi,">")
        .replace(/\s+/g," ")
        .trim();

}



function extractPublishedAt(html:string){

    const patterns=[

        /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,

        /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,

        /<time[^>]+datetime=["']([^"']+)["']/i,

        /"datePublished"\s*:\s*"([^"]+)"/i

    ];


    for(const pattern of patterns){

        const match=html.match(pattern);

        if(match?.[1]){

            const date=new Date(match[1]);

            if(!isNaN(date.getTime())){

                return date;

            }

        }

    }


    return undefined;

}



function extractMainContent(html:string){

    const selectors=[

        /<article[^>]*>([\s\S]*?)<\/article>/i,

        /<main[^>]*>([\s\S]*?)<\/main>/i,

        /<div[^>]+class=["'][^"']*(content|article|post|entry|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i

    ];


    for(const selector of selectors){

        const match=html.match(selector);


        if(match){

            const text=
                cleanText(
                    match[1] || match[2] || ""
                );


            if(text.length>300){

                return text;

            }

        }

    }


    return cleanText(html);

}



function isBadPage(title:string,content:string){

    const text =
        (title + " " + content)
        .toLowerCase();



    const codePatterns=[

        "gfdatav1",

        "_modernjs_route_manifest",

        "runtime\":\"node",

        "__next",

        "webpack",

        "sourceMappingURL",

        "window.",

        "document.",

        "datalayer",

        "function(",

        "=>",

        "const ",

        "var "

    ];



    let codeCount=0;


    for(const item of codePatterns){

        if(text.includes(item)){

            codeCount++;

        }

    }



    if(codeCount>=2){

        return true;

    }




    const pagePatterns=[

        "@media",

        "csslist",

        "siteinfo",

        "aiocdn",

        "cnpm-pep",

        "res.hc-cdn.com",

        "static/",

        "assets/"

    ];



    let pageCount=0;


    for(const item of pagePatterns){

        if(text.includes(item)){

            pageCount++;

        }

    }


    if(pageCount>=2){

        return true;

    }




    const navWords=[

        "登录",

        "注册",

        "首页",

        "联系我们",

        "解决方案",

        "产品中心",

        "大模型平台",

        "开发平台",

        "产品介绍",

        "产品服务",

        "云服务",

        "工作台"

    ];



    let navCount=0;


    for(const item of navWords){

        if(title.includes(item) || content.includes(item)){

            navCount++;

        }

    }



    if(navCount>=4){

        return true;

    }



    if(content.length < 200){

        return true;

    }



    return false;

}



export async function fetchWebSource(

    url:string

):Promise<WebNewsItem[]>{


    try{


        const response =
            await fetch(

                url,

                {

                    headers:{

                        "User-Agent":
                        "Mozilla/5.0 AI-Insight-Daily"

                    }

                }

            );



        if(!response.ok){

            console.log(
                "官网访问失败:",
                url,
                response.status
            );

            return [];

        }



        const html =
            await response.text();



        const titleMatch =
            html.match(
                /<title[^>]*>(.*?)<\/title>/i
            );



        const title =
            cleanText(
                titleMatch?.[1] || ""
            );



        if(!title){

            return [];

        }



        const content =
            extractMainContent(html);



        if(isBadPage(title,content)){

            console.log(
                "过滤官网噪声:",
                title
            );

            return [];

        }



        return [

            {

                title,

                content:
                    content.slice(0,4000),

                url,

                publishedAt:
                    extractPublishedAt(html)

            }

        ];



    }

    catch(error:any){

        console.log(

            "官网采集异常:",

            url,

            error.message

        );

        return [];

    }


}
