import { prisma } from "@/lib/prisma";

import {
    calculateNewsRanking
} from "./ranking";



export async function getRankedNews(limit:number = 20){


    const news = await prisma.news.findMany({

        orderBy:{
            createdAt:"desc"
        },

        take:100

    });



    const rankedNews = news.map((item)=>{


        /**
         * 真实性评分
         * 来自V7.4.6真实性系统
         */

        const verification =
            item.verified
            ? 95
            : 60;



        /**
         * 时间新鲜度
         */

        const hours =

            Math.floor(

                (
                    Date.now()
                    -
                    new Date(item.createdAt).getTime()

                )
                /
                (1000*60*60)

            );



        const freshness =

            Math.max(

                100 - hours * 5,

                20

            );



        /**
         * 模拟热度数据
         * 后续接入浏览量/互动数据表
         */

        const views =
            Math.floor(
                Math.random()*10000
            );



        const likes =
            Math.floor(
                Math.random()*1000
            );



        const comments =
            Math.floor(
                Math.random()*300
            );



        /**
         * 行业影响评分
         * 后续接AI分析模型
         */

        const impact = 80;



        const ranking =
            calculateNewsRanking({

                views,

                likes,

                comments,

                freshness,

                verification,

                impact

            });



        return {


            ...item,


            ranking



        };


    });



    return rankedNews

        .sort(

            (a,b)=>

                b.ranking.finalScore
                -
                a.ranking.finalScore

        )

        .slice(
            0,
            limit
        );


}