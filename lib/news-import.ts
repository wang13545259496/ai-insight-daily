import { prisma } from "@/lib/prisma";
import { fetchRSSNews } from "@/lib/rss";



/**
 * 新闻智能分类
 */
function classifyNews(title:string){


  const text =
    title.toLowerCase();



  // Agent智能体

  if(

    text.includes("agent") ||

    text.includes("智能体") ||

    text.includes("自动化")

  ){

    return "Agent";

  }




  // 机器人

  if(

    text.includes("机器人") ||

    text.includes("robot") ||

    text.includes("robotics")

  ){

    return "机器人";

  }




  // AI模型

  if(

    text.includes("gpt") ||

    text.includes("模型") ||

    text.includes("大模型") ||

    text.includes("llm") ||

    text.includes("claude") ||

    text.includes("gemini")

  ){

    return "AI模型";

  }




  // AI创业

  if(

    text.includes("创业") ||

    text.includes("融资") ||

    text.includes("startup") ||

    text.includes("投资")

  ){

    return "AI创业";

  }




  // 默认

  return "行业动态";


}






export async function importNews(){



  const rssNews =
    await fetchRSSNews();



  let created = 0;




  for(const item of rssNews){



    // 新闻去重

    const exists =
      await prisma.news.findFirst({

        where:{

          title:item.title

        }

      });



    if(exists){

      continue;

    }





    const category =
      classifyNews(item.title);





    await prisma.news.create({

      data:{


        title:
          item.title,



        category,



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



    created++;


  }




  return {


    success:true,


    created,


    total:rssNews.length


  };



}