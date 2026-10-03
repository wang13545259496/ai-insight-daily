import { prisma } from "@/lib/prisma";

import {
    getHotNews
}
from "@/lib/news/getHotNews";




export async function generateDailyReport(){



    const hotNews =
        await getHotNews(10);





    const hotEvents =
        await prisma.newsEvent.findMany({


            orderBy:{


                heatScore:"desc"


            },


            take:5,


            include:{


                news:{


                    select:{


                        id:true


                    }


                }


            }


        });







    const today = new Date()

        .toISOString()

        .split("T")[0];







    let content = `

# AI Insight Daily - ${today}



## 🔥 今日AI热点事件



`;





    hotEvents.forEach((event,index)=>{


        content += `

${index + 1}. ${event.title}


热度：

${event.heatScore}


趋势：

${event.trendStatus}


关联新闻：

${event.news.length} 条



`;



    });








    content += `


## 📰 今日重点新闻



`;







    hotNews.forEach((item,index)=>{


        content += `

${index + 1}. ${item.title}


来源：

${item.source}


摘要：

${item.summary}



`;


    });









    content += `


## 📈 今日趋势观察



AI行业重点关注：


- 大模型能力持续升级

- AI Agent应用生态扩展

- 企业AI应用落地

- AI商业机会增长



`;







    return {



        title:

        `AI Insight Daily ${today}`,



        content,



        date:today



    };



}