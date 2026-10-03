import {
  normalizeTitle
} from "./deduplicate";


export interface DuplicateResult {

  similarity:number;

  timeScore:number;

  sourceScore:number;

  duplicateScore:number;

}



/**
 * 新闻通用词过滤
 */
const stopWords = [

  "ai",
  "人工智能",
  "智能",
  "技术",
  "科技",
  "新闻",
  "发布",
  "推出",
  "更新",
  "升级",
  "最新",
  "模型",
  "系统",
  "平台",
  "能力",
  "应用",
  "发展"

];



/**
 * 标题关键词提取
 */
function extractKeywords(
  title:string
):string[]{


  const words =
  (
    normalizeTitle(title)
      .match(
        /[a-zA-Z0-9]+|[\u4e00-\u9fa5]{2,}/g
      )
      ||
      []
  )
  .map(
    item =>
    item.toLowerCase()
  )
  .filter(
    word =>
    !stopWords.includes(word)
  );



  return Array.from(
    new Set(words)
  );


}



/**
 * 标题相似度
 */
function titleSimilarity(

  title1:string,

  title2:string

):number{


  const words1 =
    extractKeywords(title1);



  const words2 =
    extractKeywords(title2);



  if(
    words1.length===0 ||
    words2.length===0
  ){

    return 0;

  }



  let same = 0;



  for(
    const word of words1
  ){

    if(
      words2.includes(word)
    ){

      same++;

    }

  }



  const maxLength =
    Math.max(
      words1.length,
      words2.length
    );



  const similarity =
    same /
    maxLength;



  return Number(
    similarity.toFixed(2)
  );

}





/**
 * 时间评分
 */
function calculateTimeScore(

  date1:Date,

  date2:Date

):number{


  const diff =
    Math.abs(
      date1.getTime()
      -
      date2.getTime()
    );



  const hours =
    diff /
    (
      1000 *
      60 *
      60
    );



  if(
    hours <=24
  ){

    return 1;

  }



  if(
    hours <=72
  ){

    return 0.5;

  }



  return 0.2;

}





/**
 * 来源评分
 */
function calculateSourceScore(

source1:string,

source2:string

):number{


  if(
    source1===source2
  ){

    return 1;

  }



  return 0.3;


}





/**
 * 智能重复分析
 */
export function analyzeDuplicate(

news1:{
 title:string;
 source:string;
 createdAt:Date;
},

news2:{
 title:string;
 source:string;
 createdAt:Date;
}

):DuplicateResult{


  const similarity =
    titleSimilarity(
      news1.title,
      news2.title
    );



  const timeScore =
    calculateTimeScore(
      news1.createdAt,
      news2.createdAt
    );



  const sourceScore =
    calculateSourceScore(
      news1.source,
      news2.source
    );



  /**
   * 硬限制
   *
   * 标题相似度不足
   * 直接认为不是重复
   */
  if(
    similarity < 0.85
  ){

    return {

      similarity,

      timeScore,

      sourceScore,

      duplicateScore:0

    };

  }



  const duplicateScore =
    Number(
      (
        similarity * 0.95
        +
        timeScore * 0.03
        +
        sourceScore * 0.02
      )
      .toFixed(2)
    );



  return {

    similarity,

    timeScore,

    sourceScore,

    duplicateScore

  };


}