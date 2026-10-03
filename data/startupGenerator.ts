export interface StartupProject {


id:number;


input:string;


projectName:string;


targetUsers:string[];


painPoints:string[];


products:string[];


businessModels:string[];


mvp:string[];


marketAnalysis:string;


}



export const startupProjects:StartupProject[]=[


{


id:1,


input:"阿勒泰旅游AI助手",


projectName:"AI旅游智能助手",



targetUsers:[

"游客",

"旅行社",

"本地旅游商家"

],



painPoints:[

"游客不知道如何规划路线",

"旅游信息分散",

"个性化推荐不足"

],



products:[

"AI旅行路线规划",

"AI景点问答",

"本地美食推荐",

"智能旅游攻略生成"

],



businessModels:[

"会员订阅",

"商家推广",

"旅游企业合作"

],



mvp:[

"AI路线规划功能",

"景点知识库",

"本地推荐系统"

],



marketAnalysis:

"旅游行业正在进行数字化升级，AI可以帮助游客提升旅行体验，同时帮助本地商家提高服务效率。"


},





{


id:2,


input:"企业AI办公助手",


projectName:"AI企业效率助手",



targetUsers:[

"中小企业",

"企业管理者"

],



painPoints:[

"办公流程效率低",

"企业知识管理困难",

"重复工作较多"

],



products:[

"企业知识库",

"AI办公助手",

"流程自动化Agent"

],



businessModels:[

"SaaS订阅",

"企业服务",

"定制开发"

],



mvp:[

"AI文档助手",

"企业搜索",

"自动化工作流"

],



marketAnalysis:

"企业正在寻找降低成本和提高效率的AI解决方案，企业级AI应用具有长期发展空间。"


}


];