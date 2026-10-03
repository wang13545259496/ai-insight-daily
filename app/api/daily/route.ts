import { fetchNews } from "@/lib/crawler/fetchNews";
import { generateDailyReport } from "@/lib/ai/dailyReport";



export async function GET() {

  try {

    const news = await fetchNews();


    const report = generateDailyReport(news);


    return Response.json(

      {
        success: true,

        count: report.length,

        updatedAt: new Date().toISOString(),

        data: report,
      },

      {
        headers: {

          "Cache-Control":
            "no-store, no-cache, must-revalidate",

        },
      }

    );

  } catch (error) {

    console.error(
      "Daily news API error:",
      error
    );


    return Response.json(

      {
        success: false,

        count: 0,

        data: [],

        error:
          "AI资讯实时数据获取失败",
      },

      {
        status: 500,

      }

    );

  }

}