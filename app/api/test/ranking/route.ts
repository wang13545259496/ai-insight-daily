import {
    getRankedNews
}
from "@/lib/news/rankNews";


export async function GET(){


    const news =
        await getRankedNews(10);



    return Response.json({

        success:true,

        count:news.length,

        data:news

    });


}