export interface Opportunity {


id:number;


industry:string;


title:string;


trend:string;


market:string;


businessModel:string;


description:string;


difficulty:
"低"
|
"中"
|
"高";


score:number;


tags:string[];


}



export const opportunities:Opportunity[]=[



{


id:1,


industry:"企业服务",


title:"AI企业智能助手",


trend:"高速增长",


market:"企业办公自动化市场",


businessModel:

"SaaS订阅 + 企业服务",


description:

"利用AI Agent帮助企业完成知识管理、流程自动化、客户服务和内部办公升级。",


difficulty:"中",


score:95,


tags:[

"AI Agent",
"SaaS",
"企业服务"

]


},






{


id:2,


industry:"内容产业",


title:"AI内容生产平台",


trend:"快速发展",


market:"短视频、自媒体、电商内容市场",


businessModel:

"工具订阅 + 增值服务",


description:

"利用生成式AI帮助用户完成文案、图片、视频和营销内容生产。",


difficulty:"低",


score:92,


tags:[

"AIGC",
"内容",
"创作工具"

]


},






{


id:3,


industry:"教育",


title:"AI个性化学习助手",


trend:"持续增长",


market:"在线教育和职业培训市场",


businessModel:

"会员订阅 + 教育服务",


description:

"通过AI实现个性化辅导、学习规划和知识问答。",


difficulty:"中",


score:90,


tags:[

"AI教育",
"智能助手",
"学习"

]


},






{


id:4,


industry:"医疗健康",


title:"AI健康管理助手",


trend:"长期机会",


market:"健康管理市场",


businessModel:

"服务订阅 + 企业合作",


description:

"利用AI帮助用户进行健康知识管理、信息整理和生活方式优化。",


difficulty:"高",


score:88,


tags:[

"AI医疗",
"健康",
"智能服务"

]


},






{


id:5,


industry:"开发者生态",


title:"AI开发助手平台",


trend:"高速增长",


market:"软件开发市场",


businessModel:

"开发者订阅 + 企业授权",


description:

"帮助程序员完成代码生成、测试、调试和软件开发流程优化。",


difficulty:"中",


score:94,


tags:[

"AI Coding",
"开发工具",
"Agent"

]


},






{


id:6,


industry:"传统行业升级",


title:"AI行业解决方案",


trend:"巨大潜力",


market:"传统企业数字化市场",


businessModel:

"项目交付 + 长期服务",


description:

"针对物业、制造、零售、农业等行业提供AI智能化升级方案。",


difficulty:"高",


score:91,


tags:[

"产业AI",
"数字化",
"企业升级"

]


}



];