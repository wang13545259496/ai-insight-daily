import { saveDailyReport } from "@/lib/daily/saveDailyReport";


import { getHotNews } from "@/lib/news/getHotNews";


import { getNewsTrend } from "@/lib/news/predictTrend";



export async function runNewsPipeline(){



    console.log(
        "========== AI新闻自动化流水线启动 =========="
    );



    /**
     * 1. 获取热门新闻
     */

    const hotNews = await getHotNews(10);



    console.log(
        "热门新闻数量:",
        hotNews.length
    );





    /**
     * 2. 趋势分析
     */

    const trends = await getNewsTrend();



    console.log(
        "趋势分析完成:",
        trends.length
    );





    /**
     * 3. 自动生成日报
     */

    const report = await saveDailyReport();



    console.log(
        "日报生成完成:",
        report.title
    );





    return {


        success:true,


        hotCount:hotNews.length,


        trendCount:trends.length,


        reportId:report.id


    };


}