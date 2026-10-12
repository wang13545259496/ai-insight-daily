import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";

import {
    calculateQualityScore,
    shouldAcceptNews
} from "../lib/crawler/qualityScore";
import { fetchWebSource } from "@/lib/crawler/webFetcher";

const prisma = new PrismaClient();

const parser = new Parser();


function cleanText(text:string){

    if(!text){
        return "";
    }

    return text
        .replace(/<[^>]+>/g," ")
        .replace(/\s+/g," ")
        .trim();

}






async function main(){


console.log(
"启动 V7.4.8.11 AI 情报质量采集系统..."
);



const sources =
await prisma.source.findMany({

    where:{
        enabled:true
    }

});



console.log(
`新闻源数量:${sources.length}`
);



let created=0;
let duplicate=0;
let filtered=0;



for(const source of sources){



    console.log(
        `正在采集:${source.name}`
    );



    let items:any[] = [];


    if(source.rssUrl){


        const feed =
        await parser.parseURL(
            source.rssUrl
        );


        items =
        feed.items;


    }
    else{


        console.log(
            `官网采集:${source.name}`
        );


        const webItems =
        await fetchWebSource(
            source.url
        );


        items =
        webItems.map(item=>({

            title:item.title,

            content:item.content,

            summary:item.content,

            link:item.url

        }));


    }



    try{


        for(const item of items){


            const title =
            cleanText(
                item.title || ""
            );


            const content =
            cleanText(
                item.contentSnippet ||
                item.content ||
                item.summary ||
                ""
            );



            const score =
            calculateQualityScore(

                source.name,

                title,

                content

            );



            if(
                !shouldAcceptNews(
                    title,
                    content,
                    score
                )
            ){

                console.log(
                    `过滤:${title} 质量:${score}`
                );

                filtered++;

                continue;

            }



            const exists =
            await prisma.news.findFirst({

                where:{
                    title:title
                }

            });



            if(exists){

                duplicate++;

                continue;

            }



            await prisma.news.create({

                data:{


                    title,


                    category:
                    source.name,


                    summary:
                    content.substring(
                        0,
                        500
                    ) ||
                    title,


                    content:
                    content ||
                    title,


                    source:
                    source.name,


                    sourceUrl:
                    item.link || source.url,


                    verified:true,


                    dataStatus:
                    "active",


                    sourceCount:1,


                    originalSourceCount:1,


                    aiScore:score,


                    analysisStatus:
                    "pending",


                    sourceId:
                    source.id


                }

            });



            created++;


            console.log(
                `新增:${title} score:${score}`
            );


        }



    }
    catch(error:any){


        console.log(

            `采集失败:${source.name}`,

            error.message

        );


    }


}



console.log(
"================================"
);


console.log(
`新增:${created}`
);


console.log(
`重复:${duplicate}`
);


console.log(
`过滤:${filtered}`
);



console.log(
"AI 情报质量采集完成"
);



}



main()

.catch(error=>{

console.error(error);

process.exit(1);

})

.finally(async()=>{

await prisma.$disconnect();

});
