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
category:"全球AI公司",
trust:100,
enabled:true
},


{
id:2,
name:"Google AI",
type:"official",
method:"rss",
url:"https://blog.google/technology/ai/rss/",
category:"全球AI公司",
trust:100,
enabled:true
},


{
id:3,
name:"Google DeepMind",
type:"official",
method:"web",
url:"https://deepmind.google/discover/blog/",
category:"全球AI公司",
trust:100,
enabled:true
},


{
id:4,
name:"Microsoft AI",
type:"official",
method:"rss",
url:"https://news.microsoft.com/source/topics/ai/feed/",
category:"全球AI公司",
trust:100,
enabled:true
},


{
id:5,
name:"Anthropic",
type:"official",
method:"web",
url:"https://www.anthropic.com/news",
category:"全球AI公司",
trust:100,
enabled:true
},


{
id:6,
name:"Meta AI",
type:"official",
method:"web",
url:"https://ai.meta.com/blog/",
category:"全球AI公司",
trust:95,
enabled:true
},


{
id:7,
name:"NVIDIA AI Blog",
type:"official",
method:"web",
url:"https://blogs.nvidia.com/blog/category/deep-learning/",
category:"AI基础设施",
trust:95,
enabled:true
},



{
id:8,
name:"DeepSeek",
type:"official",
method:"web",
url:"https://www.deepseek.com/",
category:"中国AI",
trust:95,
enabled:true
},


{
id:9,
name:"阿里云通义千问",
type:"official",
method:"web",
url:"https://tongyi.aliyun.com/",
category:"中国AI",
trust:95,
enabled:true
},


{
id:10,
name:"腾讯混元",
type:"official",
method:"web",
url:"https://hunyuan.tencent.com/",
category:"中国AI",
trust:95,
enabled:true
},


{
id:11,
name:"腾讯AI",
type:"official",
method:"web",
url:"https://ai.tencent.com/",
category:"中国AI",
trust:95,
enabled:true
},


{
id:12,
name:"百度智能云",
type:"official",
method:"web",
url:"https://cloud.baidu.com/product/wenxinworkshop",
category:"中国AI",
trust:90,
enabled:true
},


{
id:13,
name:"华为盘古大模型",
type:"official",
method:"web",
url:"https://www.huaweicloud.com/product/modelarts.html",
category:"中国AI",
trust:90,
enabled:true
},


{
id:14,
name:"字节豆包",
type:"official",
method:"web",
url:"https://www.doubao.com/",
category:"中国AI",
trust:90,
enabled:true
},


{
id:15,
name:"智谱AI",
type:"official",
method:"web",
url:"https://www.zhipuai.cn/",
category:"中国AI",
trust:90,
enabled:true
},


{
id:16,
name:"月之暗面Kimi",
type:"official",
method:"web",
url:"https://www.moonshot.cn/",
category:"中国AI",
trust:90,
enabled:true
},


{
id:17,
name:"MiniMax",
type:"official",
method:"web",
url:"https://www.minimaxi.com/",
category:"中国AI",
trust:90,
enabled:true
},


{
id:18,
name:"阶跃星辰",
type:"official",
method:"web",
url:"https://www.stepfun.com/",
category:"中国AI",
trust:90,
enabled:true
},


{
id:19,
name:"知乎AI",
type:"community",
method:"api",
url:"https://www.zhihu.com/topic/19552832",
category:"社区趋势",
trust:70,
enabled:false
},


{
id:20,
name:"微博AI热点",
type:"community",
method:"api",
url:"https://weibo.com",
category:"热点趋势",
trust:65,
enabled:false
}



];
