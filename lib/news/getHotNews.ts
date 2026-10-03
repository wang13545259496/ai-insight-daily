import { prisma } from "@/lib/prisma";


import {
    calculateHotScore
}
from "./hotScore";



export async function getHotNews(limit:number = 20){


    const news = await prisma.news.findMany({


        take:100,


        orderBy:{


            createdAt:"desc"


        }


    });



    const result = news.map(item=>{


        /**
         * 当前版本数据库暂未接入 NewsMetrics
         * 使用默认热度指标
         * 后续接入真实统计表
         */


        const metrics = {


            views:0,


            likes:0,


            favorites:0,


            shares:0,


            comments:0


        };



        const hotScore = calculateHotScore(metrics);



        return {


            ...item,


            hotScore


        };


    });



    return result

        .sort(

            (a,b)=>

                b.hotScore.finalScore

                -

                a.hotScore.finalScore

        )

        .slice(0,limit);



}