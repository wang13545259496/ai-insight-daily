import { NextResponse } from "next/server";


import {
    runNewsPipeline
}
from "@/lib/scheduler/newsPipeline";



export async function GET(){


    try{


        const result = await runNewsPipeline();



        return NextResponse.json({


            success:true,


            data:result


        });



    }catch(error){


        console.error(error);



        return NextResponse.json({


            success:false,


            message:"AI新闻流水线执行失败"


        },

        {

            status:500

        });


    }


}