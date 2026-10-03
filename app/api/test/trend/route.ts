import { NextResponse } from "next/server";


import {
    getNewsTrend
}
from "@/lib/news/predictTrend";



export async function GET(){


    try {


        const data = await getNewsTrend();



        return NextResponse.json({

            success:true,

            data

        });



    } catch(error){


        console.error(error);



        return NextResponse.json({

            success:false,

            message:"趋势预测失败"

        },
        {
            status:500
        });


    }


}