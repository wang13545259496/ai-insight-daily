import { prisma } from "@/lib/prisma";


// ===============================
// AI关键词库
// ===============================

const keywordGroups = [

  [
    "GPT",
    "GPT-6",
    "模型",
    "大模型",
    "发布",
    "升级"
  ],

  [
    "Agent",
    "智能体",
    "AI助手",
    "自动化"
  ],

  [
    "芯片",
    "GPU",
    "NVIDIA",
    "算力"
  ],

  [
    "机器人",
    "人形机器人",
    "自动驾驶"
  ],

  [
    "创业",
    "融资",
    "投资"
  ],

  [
    "Gemini",
    "Google AI",
    "Google"
  ],

  [
    "Claude",
    "Anthropic"
  ],

  [
    "OpenAI",
    "ChatGPT"
  ]

];



// ===============================
// 提取关键词
// ===============================

function extractKeywords(title:string){

  const result:string[]=[];


  for(const group of keywordGroups){

    for(const word of group){

      if(
        title
        .toLowerCase()
        .includes(
          word.toLowerCase()
        )
      ){

        result.push(word);

      }

    }

  }


  return result;

}




// ===============================
// 标题相似度
// ===============================

function titleSimilarity(
  a:string,
  b:string
){

  const aWords =
    extractKeywords(a);


  const bWords =
    extractKeywords(b);


  const same =
    aWords.filter(
      x=>bWords.includes(x)
    );


  return same.length;

}




// ===============================
// 时间窗口
// ===============================

function withinDays(
  date:Date,
  days:number
){

  const now =
    new Date();


  const diff =
    now.getTime()
    -
    date.getTime();


  return (
    diff <
    days *
    24 *
    60 *
    60 *
    1000
  );

}




// ===============================
// 构建热点事件
// ===============================

export async function buildNewsEvents(){


  const news =
    await prisma.news.findMany({

      orderBy:{
        createdAt:"desc"
      },

      take:500

    });



  interface ClusterNews {
  id:number;
  source:string;
  title:string;
  category:string;
  createdAt:Date;
}

interface NewsCluster {
  title:string;
  keywords:string[];
  news:ClusterNews[];
  category?:string;
}

const clusters:NewsCluster[]=[];



  for(const item of news){


    let matched=null;



    for(const cluster of clusters){


      const score =
        titleSimilarity(
          item.title,
          cluster.title
        );


      if(
        score >= 2 &&
        withinDays(
          item.createdAt,
          30
        )
      ){

        matched=cluster;

        break;

      }

    }




    if(matched){


      matched.news.push(item);


    }
    else{


      clusters.push({

        title:item.title,

        keywords:
          extractKeywords(
            item.title
          ),


        news:[
          item
        ]

      });


    }


  }



  let createdCount=0;



  for(const cluster of clusters){



    if(
      cluster.news.length < 2
    )
      continue;




    const heatScore =
      cluster.news.length * 5
      +
      new Set(
        cluster.news.map(
          (n:ClusterNews)=>n.source
        )
      ).size * 10;




    const exists =
      await prisma.newsEvent.findFirst({

        where:{
          title:
          cluster.title
        }

      });



    if(exists)
      continue;



    const event =
      await prisma.newsEvent.create({

        data:{

          title:
            cluster.title,


          keywords:
            cluster.keywords.join(","),


          summary:
            `该事件包含${cluster.news.length}篇相关新闻`,


          category:
            cluster.news[0].category,


          heatScore


        }

      });



    await prisma.news.updateMany({

      where:{
        id:{
          in:
          cluster.news.map(
            (n:ClusterNews)=>n.id
          )
        }
      },


      data:{
        eventId:event.id
      }

    });



    createdCount++;


  }



  console.log(
    `新增热点事件 ${createdCount} 个`
  );


  return clusters;

}