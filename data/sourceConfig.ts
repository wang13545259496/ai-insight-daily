export interface NewsSource {

name:string;

rssUrl:string;

}



export const sources:NewsSource[] = [


{
name:"OpenAI 官方博客",

rssUrl:
"https://openai.com/news/rss.xml"

},


{
name:"Google AI Blog",

rssUrl:
"https://blog.google/technology/ai/rss/"

},


{
name:"Microsoft AI Blog",

rssUrl:
"https://blogs.microsoft.com/ai/feed/"

},


{
name:"Anthropic News",

rssUrl:
"https://www.anthropic.com/news/rss.xml"

},


{
name:"百度智能云",

rssUrl:
"https://cloud.baidu.com/rss"

},


{
name:"腾讯AI",

rssUrl:
"https://cloud.tencent.com/developer/rss"

},


{
name:"知乎AI话题",

rssUrl:
"https://www.zhihu.com/topic/19552832/hot"

},


{
name:"微博AI",

rssUrl:
"https://weibo.com"

}


];