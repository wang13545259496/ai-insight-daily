export interface AgentItem {

id:number;

category:string;

name:string;

trend:string;

company:string;

description:string;

}



export const aiAgentMap:AgentItem[] = [


{
id:1,
category:"办公Agent",
name:"企业智能助手",
trend:"高速增长",
company:"OpenAI / Microsoft / Notion",
description:"帮助企业完成知识管理、办公自动化和流程优化。"
},


{
id:2,
category:"开发Agent",
name:"AI编程助手",
trend:"快速发展",
company:"OpenAI / GitHub / Anthropic",
description:"辅助程序开发、代码生成、测试和软件维护。"
},


{
id:3,
category:"营销Agent",
name:"智能营销Agent",
trend:"高速增长",
company:"AI营销平台",
description:"自动完成内容生产、用户分析和营销策略优化。"
},


{
id:4,
category:"教育Agent",
name:"AI学习助手",
trend:"持续增长",
company:"教育科技企业",
description:"提供个性化学习方案和智能辅导。"
},


{
id:5,
category:"企业服务Agent",
name:"企业决策Agent",
trend:"未来潜力",
company:"AI企业服务平台",
description:"利用AI帮助企业进行数据分析和经营决策。"
}


];