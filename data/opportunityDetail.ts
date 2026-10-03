export interface OpportunityDetail {


id:number;

title:string;

summary:string;


painPoints:string[];

products:string[];

businessModel:string[];

marketAnalysis:string;


recommendation:string;


}



export const opportunityDetails:OpportunityDetail[]=[


{


id:1,


title:"AI企业助手",


summary:
"利用AI Agent帮助企业完成办公自动化、知识管理和流程优化，是企业AI应用的重要方向。",



painPoints:[

"企业内部信息分散，员工查找资料效率低",

"大量重复办公流程消耗人工成本",

"企业希望提升运营效率"

],



products:[

"企业智能知识库",

"AI办公助手",

"流程自动化Agent",

"智能客服系统"

],



businessModel:[

"SaaS订阅收费",

"企业高级版本",

"定制化AI解决方案"

],



marketAnalysis:
"随着企业数字化升级，越来越多企业开始探索AI提升效率，企业级AI应用存在持续需求。",



recommendation:
"建议从细分行业切入，例如物业、教育、销售、客服等场景，先打造垂直AI助手。"



},




{


id:2,


title:"AI知识库",


summary:
"帮助企业建立智能知识管理系统，让员工通过AI快速获取企业内部信息。",



painPoints:[

"企业资料沉淀困难",

"新人培训成本高",

"知识无法快速复用"

],



products:[

"企业AI搜索",

"内部知识问答",

"智能文档助手"

],



businessModel:[

"SaaS订阅",

"企业服务",

"私有化部署"

],



marketAnalysis:
"知识管理是企业数字化的重要环节，AI搜索正在改变企业信息获取方式。",



recommendation:
"可以从中小企业知识管理场景切入，降低部署门槛。"



},




{


id:3,


title:"AI内容生产",


summary:
"利用AI提升内容创作、营销、电商运营效率。",



painPoints:[

"内容生产成本高",

"营销人员压力大",

"需要持续生成内容"

],



products:[

"AI文案助手",

"AI营销工具",

"AI视频生成"

],



businessModel:[

"工具订阅",

"会员服务",

"企业营销解决方案"

],



marketAnalysis:
"内容行业正在快速采用AI工具，提高生产效率。",



recommendation:
"重点关注垂直领域内容工具，例如电商、旅游、本地生活。"



}


];