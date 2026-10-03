import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/ai";


export async function GET(){


  // 获取最新新闻

  const news =
    await prisma.news.findMany({

      take:10,

      orderBy:{
        id:"desc"
      }

    });



  if(news.length === 0){

    return Response.json({

      success:false,

      message:"暂无新闻"

    });

  }



  let reportContent = "";



  for(const item of news){


    const summary =
      await generateSummary(

        item.content

      );


    reportContent += `

标题：
${item.title}


${summary}


来源：
${item.source}


----------------

`;

  }



  const today =
    new Date()
      .toISOString()
      .slice(0,10);



  const report =
    await prisma.dailyReport.create({

      data:{

        title:
        `${today} AI行业日报`,

        content:
        reportContent,

        date:
        today

      }

    });



  return Response.json({

    success:true,

    message:"日报生成完成",

    id:report.id

  });


}