import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";


export async function GET(){


    const events =
        await prisma.newsEvent.findMany({

            orderBy:{
                heatScore:"desc"
            },


            take:50,


            include:{
                news:{
                    select:{
                        id:true,
                        title:true,
                        source:true,
                        createdAt:true
                    }
                }
            }

        });



    return NextResponse.json({

        success:true,

        count:events.length,

        data:events

    });


}