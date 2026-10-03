import { prisma } from "@/lib/prisma";

import {
    createNewsHash
}
from "./newsHash";



interface NewsInput {


    title:string;


    category:string;


    background?:string;


    summary?:string;


    content?:string;


    source:string;


    sourceUrl?:string;


}





export async function mergeNews(
    data:NewsInput
){



    // 创建新闻指纹

    const hash =
    createNewsHash(
        data.title
    );





    // 查询是否已经存在相同新闻

    const exist =
    await prisma.news.findFirst({

        where:{

            duplicateHash:hash

        }

    });





    /**
     * 已存在新闻
     * 合并来源
     */

    if(exist){



        let sources:string[] =
        [];



        if(
            exist.mergedSources
        ){

            sources =
            exist.mergedSources
            .split(",");

        }




        if(
            !sources.includes(
                data.source
            )
        ){

            sources.push(
                data.source
            );

        }





        return await prisma.news.update({

            where:{

                id:
                exist.id

            },


            data:{



                sourceCount:
                sources.length,



                originalSourceCount:
                sources.length,



                mergedSources:
                sources.join(",")



            }


        });



    }





    /**
     * 新新闻
     * 创建唯一记录
     */


    return await prisma.news.create({

        data:{



            title:
            data.title,



            category:
            data.category,



            background:
            data.background
            ||
            "",



            summary:
            data.summary
            ||
            "",



            content:
            data.content
            ||
            "",



            source:
            data.source,



            sourceUrl:
            data.sourceUrl
            ||
            "",




            duplicateHash:
            hash,



            sourceCount:
            1,



            originalSourceCount:
            1,



            mergedSources:
            data.source



        }


    });


}