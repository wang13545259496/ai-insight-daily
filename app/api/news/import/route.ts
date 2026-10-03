import { prisma } from "@/lib/prisma";
import { fetchRSSNews } from "@/lib/rss";


export async function GET() {

  try {


    const rssNews = await fetchRSSNews();


    let created = 0;


    for (const item of rssNews) {


      // 去重：根据标题判断是否已经存在
      const exists =
        await prisma.news.findFirst({

          where: {
            title: item.title
          }

        });


      if (exists) {
        continue;
      }



      await prisma.news.create({

        data: {

          title: item.title,

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
          verified:
            false

        }

      });


      created++;


    }



    return Response.json({

      success: true,

      imported: created,

      total: rssNews.length

    });



  } catch (error) {


    console.error(error);


    return Response.json({

      success: false,

      error: String(error)

    },

    {
      status:500
    });


  }

}