export interface BusinessOpportunity {


id:number;

industry:string;

opportunity:string;

trend:string;

direction:string;

description:string;


}



export const businessOpportunities:BusinessOpportunity[]=[



{
id:1,

industry:"AI办公",

opportunity:"企业智能助手",

trend:"高速增长",

direction:"企业服务",

description:
"利用AI Agent帮助企业完成办公自动化、知识管理、客户服务和流程优化。"
},



{
id:2,

industry:"AI教育",

opportunity:"AI个性化学习助手",

trend:"快速发展",

direction:"教育科技",

description:
"通过人工智能分析学生学习情况，提供个性化课程规划和智能辅导。"
},



{
id:3,

industry:"AI医疗",

opportunity:"智能健康管理助手",

trend:"持续增长",

direction:"医疗服务",

description:
"利用AI帮助用户进行健康数据分析、疾病风险提醒和医疗信息管理。"
},



{
id:4,

industry:"AI营销",

opportunity:"AI营销智能体",

trend:"高速增长",

direction:"企业增长",

description:
"通过AI自动完成市场分析、客户画像、内容生成和营销策略优化。"
},



{
id:5,

industry:"AI电商",

opportunity:"AI购物顾问",

trend:"快速增长",

direction:"智能消费",

description:
"利用AI帮助消费者进行商品推荐、购买决策和售后服务。"
}



];