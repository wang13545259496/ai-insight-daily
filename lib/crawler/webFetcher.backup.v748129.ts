export interface WebNewsItem {

    title:string;

    content:string;

    url:string;

    publishedAt?:Date;

}



function cleanText(text:string){

    return (text || "")
        .replace(/<[^>]+>/g," ")
        .replace(/&nbsp;/gi," ")
        .replace(/\s+/g," ")
        .trim();

}





function extractPublishedAt(html:string){

    const patterns=[

        /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,

        /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,

        /<time[^>]+datetime=["']([^"']+)["']/i

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





function isArticlePage(url:string){

    return (

        /\/blog\//i.test(url) ||

        /\/news\//i.test(url) ||

        /\/posts?\//i.test(url) ||

        /\/article/i.test(url) ||

        /\/p\//i.test(url)

    );

}





function isNavigationPage(content:string){

    const badWords=[

        "登录",

        "注册",

        "产品",

        "解决方案",

        "联系我们",

        "加入我们",

        "首页",

        "官网"

    ];



    let count=0;


    for(const word of badWords){

        if(content.includes(word)){

            count++;

        }

    }


    return count>=4;

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



        const rawContent =
        cleanText(html);



        const content =
        rawContent.slice(0,3000);





        if(!title){

            return [];

        }





        // 官网首页过滤

        if(

            !isArticlePage(url)

            &&

            isNavigationPage(content)

        ){

            console.log(

                "跳过官网首页:",

                url

            );


            return [];

        }





        // 正文过短过滤

        if(content.length < 120){

            return [];

        }





        const publishedAt =
        extractPublishedAt(html);





        return [

            {

                title,

                content,

                url,

                publishedAt

            }

        ];



    }

    catch(error:any){


        console.log(

            "官网采集失败:",

            url

        );


        return [];

    }


}
