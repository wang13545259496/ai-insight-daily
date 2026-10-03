import { prisma } from "@/lib/prisma";


import {
    generateDailyReport
}
from "./generateDailyReport";




export async function saveDailyReport(){



    const report =
        await generateDailyReport();




    const exists =
        await prisma.dailyReport.findFirst({


            where:{


                date:report.date


            }


        });





    if(exists){


        return exists;


    }






    const result =
        await prisma.dailyReport.create({


            data:{


                title:report.title,


                content:report.content,


                date:report.date


            }


        });





    return result;



}