import { prisma } from "@/lib/prisma";


export async function getEventStats(){


    const totalEvents =
        await prisma.newsEvent.count();



    const activeEvents =
        await prisma.newsEvent.count({

            where:{
                status:"active"
            }

        });



    const risingEvents =
        await prisma.newsEvent.count({

            where:{
                trendStatus:"rising"
            }

        });



    const hotEvents =
        await prisma.newsEvent.findMany({

            orderBy:{
                heatScore:"desc"
            },


            take:5,


            select:{

                id:true,

                title:true,

                heatScore:true,

                trendStatus:true

            }

        });



    const avgHeat =
        await prisma.newsEvent.aggregate({

            _avg:{
                heatScore:true
            }

        });



    return {


        totalEvents,


        activeEvents,


        risingEvents,


        averageHeat:
            Math.round(
                avgHeat._avg.heatScore || 0
            ),


        hotEvents


    };


}