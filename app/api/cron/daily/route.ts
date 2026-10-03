import { prisma } from "@/lib/prisma";
import { fetchRSSNews } from "@/lib/rss";
import { generateSummary } from "@/lib/ai-summary";
import { generateDailyReport } from "@/lib/report-generator";


export async function GET(){


  try {


    // 1. RSS采集

    const rssNews =
      await fetchRSSNews();



    let imported = 0;



    // 2. 新闻入库

    for(const item of rssNews){


      const exists =
        await prisma.news.findFirst({

          where:{
            title:item.title
          }

        });



      if(exists){
        continue;
      }



      await prisma.news.create({

        data:{


          title:item.title,


          category:
          item.category || "AI资讯",


          background:
          "等待AI分析生成背景信息",


          summary:
          "等待AI摘要生成",


         content:
  item.content || "",


source:
  item.source,


sourceUrl:
  item.sourceUrl || null,


          verified:false


        }

      });



      imported++;


    }



    // 3. 模拟AI摘要

    const news =
      await prisma.news.findMany({

        orderBy:{
          createdAt:"desc"
        },

        take:5

      });



    for(const item of news){


      const result =
        await generateSummary(

          item.title,

          item.content

        );



      await prisma.news.update({

        where:{
          id:item.id
        },

        data:{


          background:
          result.background,


          summary:
          result.summary,


          content:
          result.content


        }


      });


    }



    // 4. 生成日报

    const report =
      await generateDailyReport();



    return Response.json({

      success:true,

      imported,

      report

    });



  }catch(error){


    console.error(error);


    return Response.json({

      success:false,

      error:String(error)

    },

    {
      status:500
    });


  }


}