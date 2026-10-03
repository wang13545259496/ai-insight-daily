import { prisma } from "@/lib/prisma";


import {
    calculateTrend
}
from "./trend";



export async function getNewsTrend(){


    const news = await prisma.news.findMany({


        take:50,


        orderBy:{


            createdAt:"desc"


        }


    });



    const result = news.map(item=>{


        /**
         * 当前浏览量
         * 
         * 目前数据库没有独立统计表
         * 后续接入 NewsMetrics 后替换
         */

        const current = 0;



        /**
         * 模拟历史周期数据
         */

        const previous = Math.floor(

            current *

            (0.5 + Math.random())

        );



        const trend = calculateTrend({


            current,


            previous


        });



        return {


            id:item.id,


            title:item.title,


            trend


        };


    });



    return result;


}