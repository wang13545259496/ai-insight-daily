import { prisma } from "@/lib/prisma";
import { checkContentQuality } from "@/lib/news/contentQualityScore";


async function main(){

    console.log("开始标记正文污染新闻...");


    const news =
        await prisma.news.findMany({

            where:{
                dataStatus:"active"
            },

            select:{
                id:true,
                title:true,
                content:true
            }

        });


    let updated = 0;


    for(const item of news){

        const result =
            checkContentQuality(
                item.content || ""
            );


        if(result.level==="polluted"){

            await prisma.news.update({

                where:{
                    id:item.id
                },

                data:{
                    dataStatus:"repair",
                    cleanReason:
                        `正文污染:${result.reasons.join(",")}`
                }

            });


            updated++;

            console.log(
                "repair:",
                item.id,
                item.title
            );

        }

    }


    console.log({
        updated
    });


    await prisma.$disconnect();

}


main();
