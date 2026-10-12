import { prisma } from "@/lib/prisma";
import { checkContentQuality } from "@/lib/news/contentQualityScore";


async function main(){

    console.log("开始新闻正文质量扫描...");


    const news =
        await prisma.news.findMany({

            where:{
                dataStatus:"active"
            },

            select:{
                id:true,
                title:true,
                source:true,
                content:true
            }

        });



    let normal = 0;

    let warning = 0;

    let polluted = 0;


    const samples:any[]=[];



    for(const item of news){


        const result =
            checkContentQuality(
                item.content || ""
            );



        if(result.level==="normal"){

            normal++;

        }
        else if(result.level==="warning"){

            warning++;

        }
        else{

            polluted++;


            if(samples.length < 30){

                samples.push({

                    id:item.id,

                    title:item.title,

                    source:item.source,

                    score:result.score,

                    reasons:result.reasons

                });

            }

        }


    }



    console.log({

        total:news.length,

        normal,

        warning,

        polluted

    });



    console.log(
        "污染样本:"
    );


    console.log(
        JSON.stringify(
            samples,
            null,
            2
        )
    );



    await prisma.$disconnect();

}



main();
