export interface DashboardStat {

id:number;

name:string;

value:string;

description:string;

}


export const dashboardStats:DashboardStat[]=[


{
id:1,
name:"AI资讯",
value:"128+",
description:"全球AI行业最新动态"
},


{
id:2,
name:"AI模型",
value:"56+",
description:"大模型与开源模型追踪"
},


{
id:3,
name:"AI Agent",
value:"36+",
description:"智能代理生态分析"
},


{
id:4,
name:"创业机会",
value:"18+",
description:"AI商业机会发现"
}


]