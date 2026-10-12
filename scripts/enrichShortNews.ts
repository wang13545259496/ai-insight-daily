import { prisma } from "@/lib/prisma";
import { enrichNews } from "@/lib/news/newsEnricher";


async function main(){

    console.log("开始增强历史短新闻...");


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


        const content =
            item.content || "";



        if(
            content.length >= 120
        ){

            continue;

        }



        const result =
            enrichNews(
                item.title,
                content
            );



        await prisma.news.update({

            where:{
                id:item.id
            },

            data:{

                content:
                    result.content,

                summary:
                    result.summary,

                background:
                    result.background,

                impact:
                    result.impact,

                businessOpportunity:
                    result.businessOpportunity

            }

        });



        updated++;


    }



    console.log({

        total:news.length,

        updated

    });


    await prisma.$disconnect();

}


main();
