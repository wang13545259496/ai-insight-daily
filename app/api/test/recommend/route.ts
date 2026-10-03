import { NextResponse } from "next/server";


import {
    getRecommendNews
}
from "@/lib/news/recommendNews";



export async function GET(){


    const data = await getRecommendNews();



    return NextResponse.json({

        success:true,

        data

    });


}