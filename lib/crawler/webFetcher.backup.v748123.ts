export interface WebNewsItem{

    title:string;

    content:string;

    url:string;

}



function cleanText(text:string){

    return (text || "")
        .replace(/<script[\s\S]*?<\/script>/gi,"")
        .replace(/<style[\s\S]*?<\/style>/gi,"")
        .replace(/<[^>]+>/g," ")
        .replace(/\s+/g," ")
        .trim();

}



function isBadTitle(title:string){

    const badWords=[

        "首页",
        "Welcome",
        "Visitor",
        "登录",
        "Sign",
        "Home",
        "AI助手",
        "Sina Visitor System"

    ];


    return badWords.some(
        word=>title.includes(word)
    );

}



function extractContent(html:string){

    const blocks=[

        html.match(
            /<article[\s\S]*?<\/article>/i
        ),

        html.match(
            /<main[\s\S]*?<\/main>/i
        ),

        html.match(
            /<meta[^>]+description[^>]+content="([^"]+)"/i
        )

    ];


    for(const block of blocks){

        if(block && block[0]){

            const text =
            cleanText(
                block[0]
            );


            if(text.length>100){

                return text;

            }

        }

    }


    return cleanText(html);

}





export async function fetchWebSource(

url:string

):Promise<WebNewsItem[]>{


    try{


        const response =
        await fetch(url,{

            headers:{

                "User-Agent":
                "Mozilla/5.0 AI-Insight-Daily"

            }

        });



        if(!response.ok){

            console.log(
                "官网状态异常:",
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



        if(
            !title ||
            isBadTitle(title)
        ){

            console.log(
                "官网过滤:",
                title
            );

            return [];

        }



        const content =
        extractContent(html)
        .slice(0,3000);



        if(content.length<80){

            console.log(
                "官网内容不足:",
                title
            );

            return [];

        }



        return [

            {

                title,

                content,

                url

            }

        ];



    }
    catch(error){

        console.log(
            "官网采集失败:",
            url
        );


        return [];

    }


}
