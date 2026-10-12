import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { cleanContent, isBadContent } from "@/lib/news/contentCleaner";
import { enrichNews } from "@/lib/news/newsEnricher";
import { checkContentQuality } from "@/lib/news/contentQualityScore";



function normalizeTitle(title:string){

    return title
        .toLowerCase()
        .replace(/\s+/g,"")
        .replace(/[^\u4e00-\u9fa5a-z0-9]/g,"");

}



function createHash(title:string){

    return crypto
        .createHash("md5")
        .update(title)
        .digest("hex");

}





export interface RSSArticle {
    title?:string;
    link?:string;
    content?:string;
    contentSnippet?:string;
    pubDate?:string;
}
export async function saveRSSNews(

    sourceId:number,

    sourceName:string,

    articles:RSSArticle[]

){


    let savedCount = 0;



    // 单个RSS最多处理20条

    const limitedArticles =
        articles.slice(0,20);



    // 最近30天

    const limitDate =
        new Date();


    limitDate.setDate(
        limitDate.getDate()-30
    );





    for(
        const article of limitedArticles
    ){


        const cleanedContent =
            cleanContent(
                article.content || ""
            );


        const cleanedSummary =
            cleanContent(
                article.contentSnippet ||
                article.content ||
                ""
            );


        const enriched =
            enrichNews(
                article.title || "",
                cleanedContent
            );


        const contentQuality =
            checkContentQuality(
                enriched.content
            );


        const dataStatus =
            contentQuality.level === "polluted"
                ? "repair"
                : "active";


        const cleanReason =
            contentQuality.level === "polluted"
                ? `正文污染:${contentQuality.reasons.join(",")}`
                : null;


        if(
            isBadContent(
                cleanedContent
            )
        ){
            continue;
        }



        if(
            !article.title ||
            !article.link
        ){

            continue;

        }




        const cleanTitle =
            normalizeTitle(
                article.title
            );



        if(!cleanTitle){

            continue;

        }




        const duplicateHash =
            createHash(
                cleanTitle
            );





        // 检查重复

        const exists =
            await prisma.news.findFirst({

                where:{
                    duplicateHash
                }

            });



        if(exists){

            continue;

        }





        // 发布时间过滤

        if(article.pubDate){


            const publishDate =
                new Date(
                    article.pubDate
                );


            if(
                publishDate < limitDate
            ){

                continue;

            }

        }







        await prisma.news.create({

            data:{


                title:
                    article.title,



                category:
                    "AI资讯",



                background:
                    enriched.background,



                summary:
                    enriched.summary,



                content:
                    enriched.content,



                impact:
                    enriched.impact,



                businessOpportunity:
                    enriched.businessOpportunity,



                // 这里写真实来源

                source:
                    sourceName,



                sourceUrl:
                    article.link,



                verified:
                    false,


                dataStatus,


                cleanReason,



                duplicateHash,



                sourceCount:
                    1,



                originalSourceCount:
                    1,



                mergedSources:
                    sourceName,



                // 关联 Source

                sourceRef:{

                    connect:{

                        id:sourceId

                    }

                }



            }

        });



        savedCount++;

    }





    // 更新RSS来源状态

    await prisma.source.update({

        where:{

            id:sourceId

        },


        data:{


            collectCount:{
                increment:1
            },


            lastCollectTime:
                new Date(),


            rssSuccessCount:{
                increment:1
            },


            rssTotalCount:{
                increment:1
            }


        }


    });





    return savedCount;


}