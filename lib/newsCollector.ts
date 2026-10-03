/**
 * AI新闻自动聚合引擎
 *
 * V7.2.2
 *
 * 功能：
 *
 * 1. 聚合所有新闻源
 * 2. 统一新闻格式
 * 3. 时间排序
 *
 */



import { NewsItem } from "@/types/news";



import { openaiSource } 
from "@/data/sources/openaiSource";


import { googleAISource }
from "@/data/sources/googleAISource";


import { microsoftSource }
from "@/data/sources/microsoftSource";


import { anthropicSource }
from "@/data/sources/anthropicSource";


import { chinaAISource }
from "@/data/sources/chinaAISource";







export function collectAINews():NewsItem[]{



const allNews = [


...openaiSource,


...googleAISource,


...microsoftSource,


...anthropicSource,


...chinaAISource


];






return allNews.sort((a,b)=>{


return (

new Date(b.time).getTime()

-

new Date(a.time).getTime()

);


});


}