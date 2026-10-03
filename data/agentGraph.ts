export interface AgentGraphNode {


id:number;


name:string;


type:string;


category:string;


description:string;


}




export const agentGraph:AgentGraphNode[]=[



{


id:1,


name:"AI Agent生态中心",


type:"核心节点",


category:"生态中心",


description:"连接各种AI智能体应用方向，形成AI产业生态网络。"


},



{


id:2,


name:"开发工具",


type:"应用节点",


category:"技术开发",


description:"AI编程助手、代码生成、软件开发、自动测试等应用方向。"


},



{


id:3,


name:"企业服务",


type:"应用节点",


category:"企业智能化",


description:"企业运营Agent、知识管理、流程自动化等应用方向。"


},



{


id:4,


name:"办公效率",


type:"应用节点",


category:"AI办公",


description:"智能文档、会议总结、信息整理和企业助手。"


},



{


id:5,


name:"营销增长",


type:"应用节点",


category:"商业增长",


description:"智能营销、内容生产、用户分析和销售支持。"


},



{


id:6,


name:"数据分析",


type:"应用节点",


category:"数据智能",


description:"商业分析、数据处理、智能决策辅助。"


},



{


id:7,


name:"客户服务",


type:"应用节点",


category:"服务自动化",


description:"AI客服、智能问答、售后服务自动化。"


}



];