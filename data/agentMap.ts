export interface AgentMapItem {


id:number;


category:string;


agent:string;


scene:string;


direction:string;


description:string;


}




export const agentMap:AgentMapItem[]=[



{


id:1,


category:"开发工具",


agent:"AI编程助手",


scene:"代码生成、程序开发、自动测试",


direction:"软件研发智能化",


description:"利用AI帮助开发者提升编码效率，降低软件开发成本，加速产品研发。"


},




{


id:2,


category:"企业服务",


agent:"企业运营Agent",


scene:"流程管理、企业知识库、业务自动化",


direction:"企业智能化升级",


description:"帮助企业优化业务流程，实现智能运营和自动化管理。"


},




{


id:3,


category:"办公效率",


agent:"企业智能助手",


scene:"文档处理、信息整理、会议总结",


direction:"AI办公革命",


description:"通过AI提升员工工作效率，实现企业知识资产智能管理。"


},




{


id:4,


category:"营销增长",


agent:"智能营销Agent",


scene:"内容生产、用户分析、销售支持",


direction:"AI驱动增长",


description:"帮助企业利用AI完成营销自动化，提高获客和转化效率。"


},




{


id:5,


category:"数据分析",


agent:"AI数据分析助手",


scene:"数据处理、商业分析、决策辅助",


direction:"智能决策系统",


description:"利用AI分析业务数据，为企业提供智能决策支持。"


},




{


id:6,


category:"客户服务",


agent:"AI客服Agent",


scene:"客户咨询、售后服务、智能问答",


direction:"服务自动化",


description:"帮助企业降低客服成本，提高客户服务体验。"


}



];