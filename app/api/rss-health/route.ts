import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(){


    const sources =
    await prisma.source.findMany({

        where:{
            rssUrl:{
                not:null
            }
        },


        select:{


            id:true,

            name:true,

            rssUrl:true,


            rssStatus:true,

            rssScore:true,

            rssFailCount:true,


            lastCheckTime:true,

            lastResponseTime:true,

            lastError:true


        },


        orderBy:[

            {
                rssScore:"desc"
            },

            {
                lastResponseTime:"asc"
            }

        ]

    });



    const total =
    sources.length;



    const healthy =
    sources.filter(
        item =>
        item.rssStatus==="healthy"
    ).length;



    const warning =
    sources.filter(
        item =>
        item.rssStatus==="warning"
    ).length;



    const failed =
    sources.filter(
        item =>
        item.rssStatus==="failed"
    ).length;



    const averageScore =
    total===0
    ?
    0
    :
    Math.round(

        sources.reduce(
            (
                sum,
                item
            )=>
            sum + item.rssScore,
            0
        )
        /
        total

    );



    return NextResponse.json({

        summary:{

            total,

            healthy,

            warning,

            failed,

            averageScore

        },


        ranking:sources

    });


}