import { prisma } from "@/lib/prisma";
import Parser from "rss-parser";
import { saveRSSNews } from "@/lib/rss/storage/saveRSSNews";



const parser = new Parser();



function getErrorMessage(error:unknown):string{

  return error instanceof Error
    ? error.message
    : String(error);

}

export async function runRSSScheduler(){


    console.log(
        "开始RSS自动采集调度..."
    );



    const sources =
        await prisma.source.findMany({

            where:{

                enabled:true,

                rssEnabled:true,

                rssUrl:{
                    not:null
                }

            },


            orderBy:{

                rssWeight:"desc"

            }

        });



    console.log(
        `发现 ${sources.length} 个RSS来源`
    );





    for(
        const source of sources
    ){


        console.log(
            `开始采集:${source.name}`
        );



        if(!source.rssUrl){

            console.log(
                "跳过，无RSS地址"
            );

            continue;

        }





        const startTime =
            Date.now();



        try{


            const feed =
                await parser.parseURL(
                    source.rssUrl
                );



            const articles =
                feed.items || [];




            const count =
                await saveRSSNews(

                    source.id,

                    source.name,

                    articles

                );





            const duration =
                Date.now()-startTime;





            await prisma.source.update({

                where:{

                    id:source.id

                },


                data:{


                    lastCollectTime:
                        new Date(),



                    lastCollectError:
                        null,



                    collectCount:{
                        increment:1
                    },



                    collectErrorCount:
                        0,



                    rssSuccessCount:{
                        increment:1
                    },



                    rssTotalCount:{
                        increment:1
                    },



                    lastResponseTime:
                        duration

                }

            });





            console.log(
                `新增新闻:${count}`
            );



        }catch(error:unknown){

            const message = getErrorMessage(error);



            console.log(
                "RSS抓取失败:",
                source.rssUrl,
                message
            );



            await prisma.source.update({

                where:{

                    id:source.id

                },


                data:{


                    lastCollectTime:
                        new Date(),



                    lastCollectError:
                        message,



                    collectErrorCount:{
                        increment:1
                    },



                    rssFailCount:{
                        increment:1
                    },



                    rssTotalCount:{
                        increment:1
                    }



                }


            });



        }



    }




    console.log(
        "RSS自动采集调度完成"
    );



}