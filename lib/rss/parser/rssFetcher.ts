import Parser from "rss-parser";


const parser = new Parser();



export interface RSSItem {


    title:string;


    link:string;


    pubDate?:string;


    content?:string;


}



export async function fetchRSS(

    rssUrl:string

):Promise<RSSItem[]>{



    try{


        const feed =
        await parser.parseURL(
            rssUrl
        );



        const items =
        feed.items.map(
            item=>({

                title:
                item.title || "",


                link:
                item.link || "",


                pubDate:
                item.pubDate,


                content:
                item.contentSnippet ||
                item.content ||
                ""


            })
        );



        return items;



    }
    catch(error){


        console.error(
            "RSS抓取失败:",
            rssUrl,
            error
        );


        throw error;


    }


}