export type SourceLevel =

  | "official"

  | "trusted_media"

  | "normal"

  | "unknown";





export interface SourceMatchResult {


  source:string;


  level:SourceLevel;


  score:number;


  reason:string;


}







const OFFICIAL_SOURCES = [


  "OpenAI",


  "Google AI",


  "Google DeepMind",


  "Microsoft AI",


  "Anthropic",


  "百度",


  "腾讯",


  "阿里云",


];








const TRUSTED_MEDIA = [


  "Reuters",


  "路透社",


  "Bloomberg",


  "彭博",


  "The Verge",


  "TechCrunch",


  "36氪",


  "机器之心",


  "量子位",


];










export function matchSource(

source:string

):SourceMatchResult {



const normalized =

source.trim().toLowerCase();





if(!normalized){


return {


source,


level:"unknown",


score:20,


reason:"缺少新闻来源"


};


}







const official =

OFFICIAL_SOURCES.some(item =>

normalized.includes(

item.toLowerCase()

)

);





if(official){


return {


source,


level:"official",


score:95,


reason:"官方机构或企业来源"


};


}







const media =

TRUSTED_MEDIA.some(item =>

normalized.includes(

item.toLowerCase()

)

);





if(media){


return {


source,


level:"trusted_media",


score:85,


reason:"可信媒体来源"


};


}








return {


source,


level:"normal",


score:60,


reason:"普通来源，需要进一步验证"


};


}