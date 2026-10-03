export interface SourceConfig {

  name:string;

  url:string;

  category:string;

  type:"rss" | "web";

}



export const sources:SourceConfig[] = [


  {
    name:"OpenAI",
    url:"https://openai.com/news/rss.xml",
    category:"OpenAI",
    type:"rss"
  },


  {
    name:"Google AI",
    url:"https://blog.google/technology/ai/",
    category:"Google",
    type:"web"
  },


  {
    name:"Microsoft AI",
    url:"https://blogs.microsoft.com/ai/",
    category:"Microsoft",
    type:"web"
  },


  {
    name:"Anthropic",
    url:"https://www.anthropic.com/news",
    category:"Anthropic",
    type:"web"
  },


  {
    name:"百度AI",
    url:"https://www.baidu.com",
    category:"百度",
    type:"web"
  },


  {
    name:"腾讯AI",
    url:"https://www.tencent.com",
    category:"腾讯",
    type:"web"
  }


];