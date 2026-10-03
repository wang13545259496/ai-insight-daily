import { NextResponse } from "next/server";


import {
    saveDailyReport
}
from "@/lib/daily/saveDailyReport";



export async function GET(){


    try{


        const report = await saveDailyReport();



        return NextResponse.json({

            success:true,

            data:report

        });



    }catch(error){


        console.error(error);



        return NextResponse.json({

            success:false,

            message:"日报生成失败"

        },

        {

            status:500

        });


    }


}