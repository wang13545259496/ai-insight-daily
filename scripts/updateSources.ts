import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sources = [

{
name:"OpenAI 官方博客",
url:"https://openai.com/news/",
rssUrl:"https://openai.com/news/rss.xml",
type:"official",
rssWeight:100
},

{
name:"Google AI Blog",
url:"https://blog.google/technology/ai/",
rssUrl:"https://blog.google/technology/ai/rss/",
type:"official",
rssWeight:95
},

{
name:"Google DeepMind",
url:"https://deepmind.google/discover/blog/",
rssUrl:"",
type:"official",
rssWeight:95
},

{
name:"Microsoft AI Blog",
url:"https://blogs.microsoft.com/ai/",
rssUrl:"https://news.microsoft.com/source/topics/ai/feed/",
type:"official",
rssWeight:95
},

{
name:"Anthropic News",
url:"https://www.anthropic.com/news",
rssUrl:"",
type:"official",
rssWeight:90
},

{
name:"Meta AI",
url:"https://ai.meta.com/blog/",
rssUrl:"",
type:"official",
rssWeight:85
},

{
name:"NVIDIA AI Blog",
url:"https://blogs.nvidia.com/blog/category/deep-learning/",
rssUrl:"",
type:"official",
rssWeight:85
},

{
name:"DeepSeek",
url:"https://www.deepseek.com/",
rssUrl:"",
type:"company",
rssWeight:95
},

{
name:"阿里云通义千问",
url:"https://tongyi.aliyun.com/",
rssUrl:"",
type:"company",
rssWeight:95
},

{
name:"百度智能云",
url:"https://cloud.baidu.com/product/wenxinworkshop",
rssUrl:"",
type:"company",
rssWeight:85
},

{
name:"腾讯AI",
url:"https://ai.tencent.com/",
rssUrl:"",
type:"company",
rssWeight:85
},

{
name:"腾讯混元",
url:"https://hunyuan.tencent.com/",
rssUrl:"",
type:"company",
rssWeight:85
},

{
name:"华为盘古大模型",
url:"https://www.huaweicloud.com/product/pangu.html",
rssUrl:"",
type:"company",
rssWeight:85
},

{
name:"字节豆包",
url:"https://www.doubao.com/",
rssUrl:"",
type:"company",
rssWeight:80
},

{
name:"智谱AI",
url:"https://www.zhipuai.cn/",
rssUrl:"",
type:"company",
rssWeight:80
},

{
name:"月之暗面Kimi",
url:"https://www.moonshot.cn/",
rssUrl:"",
type:"company",
rssWeight:80
},

{
name:"MiniMax",
url:"https://www.minimaxi.com/",
rssUrl:"",
type:"company",
rssWeight:80
},

{
name:"阶跃星辰",
url:"https://www.stepfun.com/",
rssUrl:"",
type:"company",
rssWeight:80
}

];


async function main(){

console.log("开始同步 AI 情报来源...");

for(const source of sources){

await prisma.source.upsert({

where:{
name:source.name
},

update:{
url:source.url,
rssUrl:source.rssUrl || null,
type:source.type,
rssWeight:source.rssWeight
},

create:{
name:source.name,
url:source.url,
rssUrl:source.rssUrl || null,
type:source.type,
status:"active",
enabled:true,
rssEnabled:Boolean(source.rssUrl),
rssWeight:source.rssWeight
}

});

console.log(`同步成功:${source.name}`);

}

console.log("AI 情报来源升级完成");

}


main()
.finally(async()=>{

await prisma.$disconnect();

});
