export interface WebNewsItem {

    title:string;

    content:string;

    url:string;

    publishedAt?:Date;

}



function cleanText(text:string){

    return (text || "")
        .replace(/<[^>]+>/g," ")
        .replace(/\s+/g," ")
        .trim();

}



function extractPublishedAt(html:string){

    const patterns = [

        /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,

        /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,

        /<time[^>]+datetime=["']([^"']+)["']/i

    ];



    for(const pattern of patterns){

        const match = html.match(pattern);


        if(match?.[1]){

            const date = new Date(match[1]);


            if(!isNaN(date.getTime())){

                return date;

            }

        }

    }


    return undefined;

}



export async function fetchWebSource(

    url:string

):Promise<WebNewsItem[]>{


    try{


        const response = await fetch(
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



        const content =
        cleanText(html)
        .slice(0,2000);



        if(!title){

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
