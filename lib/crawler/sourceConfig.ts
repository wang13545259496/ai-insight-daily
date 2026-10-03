export type SourceType =

"official"

|

"media"

|

"community";




export type CrawlMethod =

"rss"

|

"web"

|

"api";





export interface SourceConfig {


id:number;


name:string;


type:SourceType;


method:CrawlMethod;


url:string;


category:string;


trust:number;


enabled:boolean;


}





export const sourceConfigs:SourceConfig[]=[




{

id:1,

name:"OpenAI",

type:"official",

method:"rss",

url:"https://openai.com/news/rss.xml",

category:"AI公司",

trust:100,

enabled:true

},




{

id:2,

name:"Google AI",

type:"official",

method:"rss",

url:"https://blog.google/technology/ai/",

category:"AI公司",

trust:100,

enabled:true

},




{

id:3,

name:"Microsoft AI",

type:"official",

method:"web",

url:"https://blogs.microsoft.com/ai/",

category:"AI公司",

trust:100,

enabled:true

},





{

id:4,

name:"Anthropic",

type:"official",

method:"rss",

url:"https://www.anthropic.com/news",

category:"AI公司",

trust:100,

enabled:true

},





{

id:5,

name:"百度AI",

type:"official",

method:"web",

url:"https://ai.baidu.com/",

category:"中国AI",

trust:95,

enabled:true

},





{

id:6,

name:"腾讯AI",

type:"official",

method:"web",

url:"https://ai.tencent.com/",

category:"中国AI",

trust:95,

enabled:true

},





{

id:7,

name:"知乎AI",

type:"community",

method:"api",

url:"https://www.zhihu.com",

category:"社区趋势",

trust:70,

enabled:false

},





{

id:8,

name:"微博AI热点",

type:"community",

method:"api",

url:"https://weibo.com",

category:"热点趋势",

trust:65,

enabled:false

}



];