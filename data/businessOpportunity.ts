export interface BusinessOpportunity {


id:number;


// 基础信息

title:string;

industry:string;

category:string;



// AI商业评分指标

marketSize:number;
// 市场规模 0-100


growthRate:number;
// 增长速度 0-100


enterpriseDemand:number;
// 企业需求 0-100


maturityScore:number;
// 商业成熟度 0-100



// 综合评分

score:number;



// 商业分析信息

growth:string;


market:string;


painPoints:string;


solution:string;


businessModel:string;


maturity:string;


investment:string;


recommendation:string;


}







export const businessOpportunityData:BusinessOpportunity[]=[




{

id:1,


title:"AI企业智能助手",


industry:"企业服务",


category:"AI Agent",



// 评分基础数据

marketSize:95,

growthRate:90,

enterpriseDemand:95,

maturityScore:88,



score:92,



growth:"高速增长",


market:
"企业数字化升级需求持续扩大，AI Agent正在进入办公、知识管理和流程自动化场景",



painPoints:
"企业内部知识分散，员工查询效率低，大量重复工作消耗人力",



solution:
"通过AI Agent连接企业知识库、办公系统和业务流程，实现智能问答、任务执行和自动化办公",



businessModel:
"SaaS订阅 + 企业定制服务",



maturity:
"商业化成熟期",



investment:
"高",



recommendation:
"适合打造企业级AI助手平台，服务中小企业智能化升级"

},






{


id:2,


title:"AI智能客服系统",


industry:"客户服务",


category:"企业自动化",



marketSize:85,

growthRate:82,

enterpriseDemand:90,

maturityScore:95,



score:86,



growth:"稳定增长",


market:
"客服自动化市场规模持续扩大，企业希望降低人工客服成本",



painPoints:
"人工客服成本高，服务时间有限，客户响应速度不足",



solution:
"利用大语言模型实现智能客服、多轮对话、客户分析和自动回复",



businessModel:
"软件授权 + 服务收费",



maturity:
"成熟商业阶段",



investment:
"中高",



recommendation:
"适合传统企业数字化升级和客户服务优化"

},






{


id:3,


title:"AI营销智能体",


industry:"数字营销",


category:"AI Agent",



marketSize:88,

growthRate:92,

enterpriseDemand:86,

maturityScore:82,



score:88,



growth:
"快速扩张",



market:
"企业营销自动化需求快速增长，AI内容生产和智能投放成为趋势",



painPoints:
"企业营销成本高，内容生产效率不足，用户洞察能力有限",



solution:
"利用AI生成营销内容、分析用户行为、优化营销策略",



businessModel:
"SaaS订阅 + 营销服务",



maturity:
"快速发展期",



investment:
"高",



recommendation:
"适合打造垂直行业营销智能体"

},






{


id:4,


title:"AI商业数据分析助手",


industry:"数据智能",


category:"AI分析",



marketSize:92,

growthRate:88,

enterpriseDemand:94,

maturityScore:86,



score:90,



growth:
"高速增长",



market:
"企业数据资产价值提升，商业智能需求不断增加",



painPoints:
"企业拥有大量数据，但缺少快速分析和决策能力",



solution:
"通过自然语言查询数据，自动生成商业报告和经营洞察",



businessModel:
"企业服务订阅",



maturity:
"成长阶段",



investment:
"高",



recommendation:
"适合打造下一代AI商业智能平台"

},






{


id:5,


title:"AI教育助手",


industry:"教育",


category:"智能教育",



marketSize:80,

growthRate:85,

enterpriseDemand:78,

maturityScore:75,



score:82,



growth:
"持续增长",



market:
"个性化教育需求增加，AI辅助教学逐渐普及",



painPoints:
"教师压力大，学生缺少个性化学习指导",



solution:
"AI提供学习规划、知识答疑和个性化训练",



businessModel:
"会员订阅 + 教育机构合作",



maturity:
"探索发展期",



investment:
"中",



recommendation:
"适合从细分教育场景切入"

}



];






// 根据ID获取商业机会

export function getBusinessOpportunityById(

id:number|string

){


const targetId =
Number(id);



return businessOpportunityData.find(

(item)=>

item.id===targetId

);


}