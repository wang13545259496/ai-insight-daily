import { prisma } from "@/lib/prisma";


async function main(){


    const news =
        await prisma.news.findMany({

            where:{
                sourceId:null
            }

        });


    console.log(
        "待修复:",
        news.length
    );


    const source =
        await prisma.source.findFirst({

            where:{
                type:"rss"
            }

        });


    if(!source){

        throw new Error(
            "没有找到RSS来源"
        );

    }



    await prisma.news.updateMany({

        where:{
            sourceId:null
        },

        data:{

            sourceId:
            source.id,

            mergedSources:
            "RSS"

        }

    });



    console.log(
        "新闻来源修复完成"
    );


}



main();