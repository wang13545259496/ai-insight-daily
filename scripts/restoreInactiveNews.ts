import { prisma } from "@/lib/prisma";
import { enrichNews } from "@/lib/news/newsEnricher";


function isBad(text:string){

    const words = [
        "联系我们",
        "加入我们",
        "版权所有",
        "ICP备",
        "客服热线",
        "扫码下载",
        "京ICP备",
        "意见反馈"
    ];


    return words.some(
        w=>text.includes(w)
    );

}



async function main(){

    console.log("开始恢复历史误伤新闻...");


    const list =
        await prisma.news.findMany({

            where:{
                dataStatus:"inactive"
            },

            select:{
                id:true,
                title:true,
                content:true
            }

        });



    let restored = 0;
    let skipped = 0;



    for(const item of list){


        if(
            !item.title ||
            !item.content ||
            item.content.length < 20 ||
            isBad(item.content)
        ){

            skipped++;
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

                dataStatus:"active",

                cleanReason:null,

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



        restored++;


    }



    console.log({

        total:list.length,

        restored,

        skipped

    });



    await prisma.$disconnect();

}


main();
