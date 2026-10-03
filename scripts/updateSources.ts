import { PrismaClient } from "@prisma/client";



const prisma =
new PrismaClient();



const sources = [


{
name:"OpenAI 官方博客",

url:
"https://openai.com/news/",

rssUrl:
"https://openai.com/news/rss.xml",

type:
"official"

},



{
name:"Google AI Blog",

url:
"https://blog.google/technology/ai/",

rssUrl:
"https://blog.google/technology/ai/rss/",

type:
"official"

},



{
name:"Microsoft AI Blog",

url:
"https://blogs.microsoft.com/ai/",

rssUrl:
"https://news.microsoft.com/source/topics/ai/feed/",

type:
"official"

},



{
name:"Anthropic News",
url:"https://www.anthropic.com/news",
rssUrl:"",
type:"official"
},



{
name:"百度智能云",

url:
"https://cloud.baidu.com/",

rssUrl:
"",

type:
"company"

},



{
name:"腾讯AI",

url:
"https://cloud.tencent.com/",

rssUrl:
"",

type:
"company"

},



{
name:"知乎AI话题",

url:
"https://www.zhihu.com/topic/19552832",

rssUrl:
"",

type:
"community"

},



{
name:"微博AI",

url:
"https://weibo.com",

rssUrl:
"",

type:
"community"

}



];





async function main(){


console.log(
"开始同步新闻来源..."
);



for(
const source of sources
){



await prisma.source.upsert({

where:{

name:
source.name

},


update:{


url:
source.url,


rssUrl:
source.rssUrl,


type:
source.type

},


create:{


name:
source.name,


url:
source.url,


rssUrl:
source.rssUrl,


type:
source.type


}


});



console.log(
`更新成功:${source.name}`
);


}



console.log(
"新闻来源同步完成"
);



}



main()

.finally(

async()=>{

await prisma.$disconnect();

}

);