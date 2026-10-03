import { NextResponse } from "next/server";


import {
    runNewsPipeline
}
from "@/lib/scheduler/newsPipeline";



export async function GET(request:Request){


    try{


        // 简单安全验证

        const authHeader =

            request.headers.get(
                "authorization"
            );



        if(

            process.env.CRON_SECRET &&

            authHeader !==

            `Bearer ${process.env.CRON_SECRET}`

        ){


            return NextResponse.json(

                {

                    success:false,

                    message:"Unauthorized"

                },

                {

                    status:401

                }

            );


        }





        const result = await runNewsPipeline();





        return NextResponse.json({

            success:true,

            message:"AI新闻自动流水线执行完成",

            data:result


        });



    }catch(error){



        console.error(
            "Cron执行失败:",
            error
        );



        return NextResponse.json(

            {

                success:false,

                message:"Cron执行失败"

            },

            {

                status:500

            }

        );


    }


}