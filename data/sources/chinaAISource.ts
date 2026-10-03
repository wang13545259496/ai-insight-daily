/**
 * 中国 AI 新闻源
 *
 * V7.2.1
 *
 * 覆盖：
 * 百度AI
 * 腾讯AI
 * 阿里云AI
 * 知乎AI
 * 微博AI热点
 * 微信公众号AI资讯
 *
 */


import { NewsItem } from "@/types/news";





export const chinaAISource:NewsItem[] = [





{
id:"china-ai-001",

title:
"百度文心大模型持续升级",

source:
"百度AI",

time:
"2026-09-23",

background:
"国内大模型竞争持续发展，企业正在加速探索AI应用。",

content:
"百度围绕大模型能力、智能应用和企业服务持续推进AI生态建设。",

url:
"https://ai.baidu.com",

category:
"国产大模型"

},







{
id:"china-ai-002",

title:
"腾讯AI生态持续扩展",

source:
"腾讯AI",

time:
"2026-09-23",

background:
"互联网企业正在推动AI技术与业务场景结合。",

content:
"腾讯围绕大模型、云服务和智能应用探索AI商业化方向。",

// 修复腾讯来源404
url:
"https://cloud.tencent.com/",

category:
"AI应用"

},







{
id:"china-ai-003",

title:
"阿里云人工智能服务持续发展",

source:
"阿里云AI",

time:
"2026-09-23",

background:
"云计算成为企业部署人工智能的重要基础设施。",

content:
"阿里云提供模型服务、AI开发平台和企业智能解决方案。",

// 修复阿里来源404
url:
"https://www.aliyun.com/",

category:
"企业AI"

},







{
id:"china-ai-004",

title:
"知乎AI领域讨论热度提升",

source:
"知乎",

time:
"2026-09-23",

background:
"AI技术发展推动用户关注人工智能应用和行业变化。",

content:
"知乎社区围绕AI工具、模型应用和行业趋势产生大量讨论。",

url:
"https://www.zhihu.com/",

category:
"社区趋势"

},







{
id:"china-ai-005",

title:
"微博AI热点趋势变化",

source:
"微博",

time:
"2026-09-23",

background:
"社交平台能够反映大众对AI事件的关注变化。",

content:
"微博AI热点数据可用于分析公众关注度和传播趋势。",

url:
"https://weibo.com/",

category:
"热点趋势"

},







{
id:"china-ai-006",

title:
"微信公众号AI行业资讯增长",

source:
"微信公众号",

time:
"2026-09-23",

background:
"公众号成为AI行业资讯传播的重要渠道。",

content:
"大量AI行业文章、案例分析和商业观察通过公众号传播。",

url:
"https://mp.weixin.qq.com/",

category:
"行业资讯"

}



];