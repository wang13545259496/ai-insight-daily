import { prisma } from "@/lib/prisma";
import { enrichNews } from "@/lib/news/newsEnricher";


async function main(){

    console.log("开始补全历史新闻AI分析字段...");


    const news =
        await prisma.news.findMany({

            where:{
                dataStatus:{
                    not:"inactive"
                }
            },

            select:{
                id:true,
                title:true,
                content:true,
                impact:true,
                businessOpportunity:true
            }

        });



    let updated = 0;



    for(const item of news){


        if(
            item.impact &&
            item.businessOpportunity
        ){

            continue;

        }



        const result =
            enrichNews(
                item.title,
                item.content
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
                    result.businessOpportunity,

                analysisStatus:
                    "completed",

                aiScore:
                    60

            }

        });


        updated++;


    }



    console.log({

        total:
            news.length,

        updated

    });



    await prisma.$disconnect();

}


main();
