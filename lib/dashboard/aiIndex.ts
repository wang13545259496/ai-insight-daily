import { prisma } from "@/lib/prisma";



export async function getAIIndex(){


    const totalNews = await prisma.news.count();



    const verifiedNews = await prisma.news.count({

        where:{

            verified:true

        }

    });



    const sources = await prisma.source.count();



    /**
     * 基础数据计算指数
     * 后续接入真实AI分析模型
     */


    const modelIndex = Math.min(

        100,

        Math.round(

            60 +

            totalNews / 50

        )

    );



    const agentIndex = Math.min(

        100,

        Math.round(

            55 +

            verifiedNews / 30

        )

    );



    const enterpriseIndex = Math.min(

        100,

        Math.round(

            50 +

            sources * 2

        )

    );



    const startupIndex = Math.min(

        100,

        Math.round(

            65 +

            totalNews / 100

        )

    );





    const overallIndex = Math.round(

        (

            modelIndex +

            agentIndex +

            enterpriseIndex +

            startupIndex

        )

        /

        4

    );




    return {


        overallIndex,


        modelIndex,


        agentIndex,


        enterpriseIndex,


        startupIndex,


        updateTime:new Date()


    };


}