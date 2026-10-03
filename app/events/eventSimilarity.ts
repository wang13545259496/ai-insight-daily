export interface NewsData {

  title:string;

  content?:string;

  keywords?:string[];

  createdAt:Date;

  source?:string;

}



function normalize(text:string){

  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]/g," ");

}



function wordMatch(
  a:string,
  b:string
){

  const aa =
    normalize(a)
    .split(" ")
    .filter(Boolean);


  const bb =
    normalize(b)
    .split(" ")
    .filter(Boolean);


  const same =
    aa.filter(
      x=>bb.includes(x)
    );


  return same.length /
    Math.max(
      aa.length,
      bb.length,
      1
    );

}



function timeScore(
  a:Date,
  b:Date
){

  const diff =
    Math.abs(
      a.getTime()-b.getTime()
    )
    /
    (1000*60*60*24);


  if(diff<=1)
    return 1;


  if(diff<=3)
    return 0.7;


  if(diff<=7)
    return 0.4;


  return 0.1;

}



export function calculateEventSimilarity(
 news:NewsData,
 event:NewsData
){


 const titleScore =
   wordMatch(
    news.title,
    event.title
   );


 const contentScore =
   wordMatch(
    news.content || "",
    event.content || ""
   );



 const keywordScore =
   wordMatch(
    (news.keywords||[]).join(" "),
    (event.keywords||[]).join(" ")
   );



 const dateScore =
   timeScore(
    news.createdAt,
    event.createdAt
   );



 const score =
    titleScore*0.35+
    keywordScore*0.25+
    contentScore*0.2+
    dateScore*0.1;



 return Number(
    score.toFixed(3)
 );

}