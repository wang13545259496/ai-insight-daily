export interface AgentRankingItem {


id:number;


rank:number;


name:string;


category:string;


score:number;


hot:number;


trend:string;


desc:string;


}





export const agentRanking:AgentRankingItem[]=[



{

id:2,

rank:1,

name:"AI编程助手",

category:"开发工具",

score:98,

hot:96,

trend:"高速增长",

desc:"帮助开发者完成代码生成、程序开发和自动测试，提高软件研发效率。"

},




{

id:6,

rank:2,

name:"企业运营Agent",

category:"企业服务",

score:95,

hot:94,

trend:"持续增长",

desc:"帮助企业优化运营流程，实现智能化管理和业务自动化。"

},




{

id:1,

rank:3,

name:"企业智能助手",

category:"办公效率",

score:93,

hot:92,

trend:"稳定增长",

desc:"帮助企业进行知识管理、资料整理和办公自动化。"

},




{

id:5,

rank:4,

name:"AI客服Agent",

category:"企业服务",

score:91,

hot:90,

trend:"快速增长",

desc:"帮助企业降低客服成本，提高客户服务效率。"

},




{

id:3,

rank:5,

name:"智能营销Agent",

category:"营销增长",

score:89,

hot:88,

trend:"增长中",

desc:"帮助企业完成内容生产、客户分析和营销增长。"

},




{

id:4,

rank:6,

name:"AI数据分析助手",

category:"数据分析",

score:87,

hot:86,

trend:"稳步增长",

desc:"利用AI辅助企业分析数据，提升商业决策能力。"

}



];