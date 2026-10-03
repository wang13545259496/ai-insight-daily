import { prisma } from "../lib/prisma";

import {
  analyzeEvent
} from "../lib/events/eventAnalyzer";



/**
 * V7.4.8.10.5.5.2
 *
 * AI新闻事件分析验证器
 *
 * 功能:
 *
 * 1. 查找已有新闻
 * 2. 根据关键词聚类事件
 * 3. 调用 eventAnalyzer
 * 4. 更新 NewsEvent
 * 5. 关联 News
 *
 */



async function verifyNewsEvents(){



  console.log(
    "🚀 开始 AI 新闻事件分析..."
  );




  const news =
    await prisma.news.findMany({

      orderBy:{
        createdAt:"desc"
      },

      take:200

    });




  console.log(
    `📌 当前分析新闻数量: ${news.length}`
  );



  if(news.length===0){

    console.log(
      "没有新闻数据"
    );

    return;

  }





  /**
   * 简单事件聚类
   *
   * 根据标题关键词匹配
   */

  const groups:
  Record<string, typeof news> = {};




  news.forEach(item=>{


    const words =
      item.title
      .split(/[\s,，。.!！?？-]/)
      .filter(
        word=>word.length>=2
      );



    const key =
      words[0] || "AI";



    if(!groups[key]){

      groups[key]=[];

    }



    groups[key].push(item);


  });





  let eventCount = 0;





  for(
    const key of Object.keys(groups)
  ){


    const relatedNews =
      groups[key];



    if(
      relatedNews.length < 2
    ){

      continue;

    }





    const analysis =
      analyzeEvent(
        relatedNews
      );





    const title =
      relatedNews[0].title;





    const existingEvent =
      await prisma.newsEvent.findFirst({

        where:{

          keywords:{
            contains:key
          }

        }

      });





    let event;



    if(existingEvent){


      event =
      await prisma.newsEvent.update({

        where:{
          id:existingEvent.id
        },


        data:{


          keywords:
            analysis.keywords,


          heatScore:
            analysis.heatScore,


          trendStatus:
            analysis.trendStatus,


          summary:
          `该事件包含${relatedNews.length}篇相关新闻`

        }


      });



    }else{



      event =
      await prisma.newsEvent.create({

        data:{


          title,


          keywords:
            analysis.keywords,


          summary:
          `该事件包含${relatedNews.length}篇相关新闻`,


          category:
            "AI资讯",


          heatScore:
            analysis.heatScore,


          peakScore:
            analysis.heatScore,


          trendStatus:
            analysis.trendStatus,


          status:
            "active"


        }


      });



    }






    await prisma.news.updateMany({

      where:{


        id:{
          in:
          relatedNews.map(
            item=>item.id
          )
        }


      },


      data:{


        eventId:
          event.id


      }


    });




    eventCount++;



    console.log(
      `✅ 事件完成: ${title}`
    );


    console.log(
      `关键词: ${analysis.keywords}`
    );


    console.log(
      `热度: ${analysis.heatScore}`
    );


    console.log(
      `趋势: ${analysis.trendStatus}`
    );


  }





  console.log(
    `🎉 事件分析完成，共处理 ${eventCount} 个事件`
  );





}





verifyNewsEvents()

.catch(error=>{


  console.error(
    "❌ 事件分析失败:",
    error
  );


  process.exit(1);


})

.finally(async()=>{


  await prisma.$disconnect();


});