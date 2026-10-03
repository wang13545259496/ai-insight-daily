export interface AgentMarketItem {

id:number;

name:string;

category:string;

type:string;

scene:string;

heat:string;

description:string;

users:string;

value:string;

}


export const agentMarket:AgentMarketItem[]=[


{
id:1,
name:"企业智能助手",
category:"办公效率",
type:"办公Agent",
scene:"企业知识管理、流程自动化",
heat:"★★★★★",
description:"帮助企业完成资料整理、信息检索和办公自动化。",
users:"企业管理者、行政人员、团队用户",
value:"提升办公效率，降低企业运营成本。"
},


{
id:2,
name:"AI编程助手",
category:"开发工具",
type:"开发Agent",
scene:"代码生成、程序开发、自动测试",
heat:"★★★★★",
description:"帮助开发者提高软件开发效率。",
users:"程序员、开发团队、技术创业者",
value:"降低软件开发成本，加速产品研发。"
},


{
id:3,
name:"智能营销Agent",
category:"营销增长",
type:"营销Agent",
scene:"内容生产、用户分析、销售支持",
heat:"★★★★☆",
description:"帮助企业完成智能营销和客户运营。",
users:"市场人员、电商团队、创业公司",
value:"提高营销效率，实现精准用户运营。"
},


{
id:4,
name:"AI数据分析助手",
category:"数据分析",
type:"分析Agent",
scene:"数据处理、商业分析",
heat:"★★★★☆",
description:"利用AI辅助企业进行数据分析和决策。",
users:"企业分析人员、管理者",
value:"帮助企业快速发现数据价值。"
},


{
id:5,
name:"AI客服Agent",
category:"企业服务",
type:"企业服务Agent",
scene:"客户咨询、售后服务、智能客服",
heat:"★★★★☆",
description:"帮助企业降低客服成本，提高服务效率。",
users:"企业客服、电商平台、服务行业",
value:"提高客户响应速度和服务质量。"
},


{
id:6,
name:"企业运营Agent",
category:"企业服务",
type:"企业服务Agent",
scene:"企业管理、流程优化、运营分析",
heat:"★★★★★",
description:"帮助企业提升运营效率，实现智能化管理。",
users:"企业负责人、运营团队",
value:"推动企业数字化转型。"
}


];