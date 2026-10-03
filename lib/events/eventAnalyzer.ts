import {
  News
} from "@prisma/client";



/**
 * AI事件分析引擎
 *
 * V7.4.8.10.5.5.1
 *
 * 功能:
 * 1. 新闻关键词提取
 * 2. 事件热度计算
 * 3. 趋势状态判断
 */



/**
 * 停用词
 */
const stopWords = [

  "的",
  "了",
  "和",
  "与",
  "AI",
  "人工智能",
  "最新",
  "发布",
  "介绍",
  "宣布"

];





/**
 * 提取事件关键词
 */
export function extractEventKeywords(
  news: News[]
){

  const words:string[] = [];


  news.forEach(item=>{


    const text = (

      item.title +
      " " +
      item.content

    ).toLowerCase();



    const matches =
      text.match(
        /[A-Za-z0-9\-]{2,}|[\u4e00-\u9fa5]{2,6}/g
      );


    if(matches){

      words.push(
        ...matches
      );

    }


  });




  const result =
    words

    .filter(
      word =>
      !stopWords.includes(word)
    )


    .reduce(
      (
        map,
        word
      )=>{


        map[word] =
          (map[word] || 0) + 1;


        return map;


      },
      {} as Record<string,number>

    );




  return Object.entries(result)

    .sort(
      (
        a,
        b
      )=>
      b[1]-a[1]
    )

    .slice(0,10)

    .map(
      item=>item[0]
    );


}





/**
 * 计算事件热度
 */
export function calculateEventHeat(
  news:News[]
){


  const newsScore =
    news.length * 10;



  const sourceScore =
    new Set(
      news.map(
        item=>item.source
      )
    ).size * 15;



  const keywordScore =
    extractEventKeywords(news)
      .length * 5;




  return Math.min(

    newsScore +
    sourceScore +
    keywordScore,

    1000

  );

}






/**
 * 判断趋势状态
 */
export function analyzeTrendStatus(
  heatScore:number
){


  if(
    heatScore >= 200
  ){

    return "rising";

  }



  if(
    heatScore >= 80
  ){

    return "stable";

  }



  return "falling";


}






/**
 * 生成事件分析结果
 */
export function analyzeEvent(
  news:News[]
){


  const keywords =
    extractEventKeywords(news);



  const heatScore =
    calculateEventHeat(news);



  const trendStatus =
    analyzeTrendStatus(
      heatScore
    );



  return {


    keywords:
      keywords.join(","),



    heatScore,



    trendStatus,


    newsCount:
      news.length

  };


}