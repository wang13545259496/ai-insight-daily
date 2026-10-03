export interface OpportunityItem {

name:string;

value:number;

}



export interface CategoryItem {

name:string;

value:number;

}



export interface TrendItem {

year:string;

value:number;

}





export interface AgentDashboardData {


totalAgents:number;


hotDirection:string;


categories:CategoryItem[];


trend:TrendItem[];


opportunities:OpportunityItem[];


}





export const agentDashboard:AgentDashboardData={



totalAgents:120,


hotDirection:"AI办公",



categories:[


{

name:"开发工具",

value:90

},


{

name:"企业服务",

value:80

},


{

name:"办公效率",

value:75

},


{

name:"营销增长",

value:65

},


{

name:"数据分析",

value:55

}



],




trend:[


{

year:"2024",

value:40

},


{

year:"2025",

value:60

},


{

year:"2026",

value:85

},


{

year:"2027",

value:95

}



],




opportunities:[


{

name:"AI办公助手",

value:95

},


{

name:"企业智能客服",

value:85

},


{

name:"AI营销Agent",

value:80

}



]



};