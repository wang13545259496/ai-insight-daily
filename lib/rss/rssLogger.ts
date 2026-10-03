import { prisma } from "@/lib/prisma";


export async function createRSSLog({

    sourceId,

    status,

    newsCount = 0,

    duration = 0,

    errorMessage = null


}:{

    sourceId:number;

    status:string;

    newsCount?:number;

    duration?:number;

    errorMessage?:string | null;

}){


    return prisma.rSSLog.create({

        data:{


            sourceId,

            status,

            newsCount,

            duration,

            errorMessage


        }

    });


}