import { prisma } from "@/lib/prisma";


// ===============================
// 新闻标题相似度计算
// ===============================

function calculateSimilarity(
  a: string,
  b: string
) {

  const wordsA =
    a
      .toLowerCase()
      .split("")
      .filter(Boolean);


  const wordsB =
    b
      .toLowerCase()
      .split("")
      .filter(Boolean);


  let same = 0;


  for (const word of wordsA) {

    if (wordsB.includes(word)) {

      same++;

    }

  }


  return (
    same /
    Math.max(
      wordsA.length,
      wordsB.length
    )
  );

}



// ===============================
// 自动提取关键词
// ===============================

function extractKeywords(
  title:string
){

  const keywords =
    title
      .replace(
        /[，。！？、,.!?]/g,
        " "
      )
      .split(" ")
      .filter(
        item=>item.length>1
      )
      .slice(0,8);


  return keywords.join(",");

}



// ===============================
// AI事件聚类核心
// ===============================

export async function buildEventClusters(){


  const news =
    await prisma.news.findMany({

      where:{
        eventId:null
      },

      orderBy:{
        createdAt:"desc"
      },

      take:200

    });



  interface ClusterNews {
  id:number;
  title:string;
  category:string;
}

interface NewsCluster {
  title:string;
  category:string;
  news:ClusterNews[];
}

const clusters:NewsCluster[]=[];



  for(
    const item of news
  ){


    let matched=false;



    for(
      const cluster of clusters
    ){


      const score =
        calculateSimilarity(
          item.title,
          cluster.title
        );



      if(
        score > 0.35
      ){

        cluster.news.push(item);

        matched=true;

        break;

      }


    }



    if(!matched){


      clusters.push({

        title:item.title,

        category:
          item.category,

        news:[
          item
        ]

      });


    }


  }



  // 写入事件中心

  for(
    const cluster of clusters
  ){


    if(
      cluster.news.length===0
    ){

      continue;

    }



    const event =
      await prisma.newsEvent.create({

        data:{


          title:
            cluster.title,


          keywords:
            extractKeywords(
              cluster.title
            ),



          category:
            cluster.category,



          summary:
            `围绕${cluster.title}形成的AI热点事件，共关联${cluster.news.length}条相关新闻。`,



          heatScore:
            cluster.news.length * 10,



          peakScore:
            cluster.news.length * 10,


          trendStatus:
            "rising",


          trendSummary:
            "事件处于增长阶段，正在形成市场关注。"



        }

      });




    // 绑定新闻

    for(
      const item of cluster.news
    ){


      await prisma.news.update({

        where:{
          id:item.id
        },


        data:{
          eventId:event.id
        }

      });


    }



  }



  return {

    events:
      clusters.length,


    news:
      news.length

  };


}