export interface AgentRecommendItem {


id:number;


name:string;


keywords:string[];


reason:string;


tag:string;


}





export const agentRecommend:AgentRecommendItem[]=[



{


id:1,


name:"企业智能助手",


keywords:[

"企业",

"办公",

"自动化",

"管理",

"文档",

"流程"

],


reason:

"帮助企业完成知识管理、流程自动化和办公效率提升。",


tag:"办公推荐"


},





{


id:2,


name:"AI编程助手",


keywords:[

"代码",

"开发",

"编程",

"程序",

"软件",

"技术"

],


reason:

"帮助开发者生成代码、优化程序，提高研发效率。",


tag:"开发推荐"


},





{


id:3,


name:"智能营销Agent",


keywords:[

"营销",

"销售",

"推广",

"客户",

"增长"

],


reason:

"帮助企业进行智能营销、客户分析和用户增长。",


tag:"商业推荐"


},





{


id:4,


name:"AI数据分析助手",


keywords:[

"数据",

"分析",

"报表",

"经营",

"决策"

],


reason:

"利用AI帮助企业分析数据，辅助经营决策。",


tag:"数据推荐"


},





{


id:5,


name:"AI客服Agent",


keywords:[

"客服",

"售后",

"咨询",

"服务",

"机器人"

],


reason:

"帮助企业自动处理客户咨询，提高服务效率。",


tag:"企业服务推荐"


}



];