import { getHotNews } from "./getHotNews";

import { getNewsTrend } from "./predictTrend";



export async function getRecommendNews(limit:number = 10){


    const hotNews = await getHotNews(50);


    const trends = await getNewsTrend();



    const result = hotNews.map((news)=>{


        const trendItem = trends.find(

            item => item.id === news.id

        );



        let score = 0;



        // 新闻热度评分

        score += news.hotScore.finalScore;



        // 趋势评分

        if(

            trendItem?.trend &&

            typeof trendItem.trend === "object" &&

            "direction" in trendItem.trend &&

            trendItem.trend.direction === "up"

        ){

            score += 20;

        }



        return {


            ...news,


            recommendScore:score,


            trend:trendItem?.trend ?? null


        };


    });



    return result

        .sort(

            (a,b)=>

                b.recommendScore

                -

                a.recommendScore

        )

        .slice(0,limit);


}