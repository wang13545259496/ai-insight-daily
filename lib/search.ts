import { searchData, SearchItem } from "@/data/search";



export function searchAI(
  keyword:string
):SearchItem[] {


  if(!keyword){

    return [];

  }



  const key =
  keyword
  .toLowerCase()
  .trim();



  const results =
  searchData.map(item=>{


    let matchScore = 0;



    // 标题匹配

    if(
      item.title
      .toLowerCase()
      .includes(key)
    ){

      matchScore +=40;

    }



    // 关键词匹配

    item.keywords.forEach(word=>{


      if(
        word
        .toLowerCase()
        .includes(key)
        ||
        key.includes(
          word.toLowerCase()
        )
      ){

        matchScore +=30;

      }


    });



    // 描述匹配

    if(

      item.description
      .toLowerCase()
      .includes(key)

    ){

      matchScore +=20;

    }



    // 原始评分加权

    matchScore +=
    item.score * 0.1;



    return {

      ...item,

      score:
      Math.round(matchScore)

    };


  });



  return results

  .filter(
    item =>
    item.score >10
  )


  .sort(
    (a,b)=>
    b.score-a.score
  );


}