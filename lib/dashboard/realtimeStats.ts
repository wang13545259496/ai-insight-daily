import { prisma } from "@/lib/prisma";



export async function getRealtimeStats(){


    const totalNews = await prisma.news.count();



    const verifiedNews = await prisma.news.count({

        where:{

            verified:true

        }

    });



    const totalReports = await prisma.dailyReport.count();



    const totalSources = await prisma.source.count();



    const today = new Date();


    today.setHours(0,0,0,0);



    const todayNews = await prisma.news.count({

        where:{

            createdAt:{

                gte:today

            }

        }

    });



    const verificationRate = totalNews === 0

        ?

        0

        :

        Math.round(

            verifiedNews /

            totalNews *

            100

        );



    return {


        totalNews,


        todayNews,


        verifiedNews,


        verificationRate,


        totalReports,


        totalSources,


        updateTime:new Date()


    };


}