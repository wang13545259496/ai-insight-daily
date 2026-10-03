/**
 * Agent创业机会发现引擎
 *
 * 根据：
 *
 * 1. Agent热度
 * 2. 趋势增长
 * 3. 商业价值
 * 4. 应用需求
 *
 * 发现潜在AI创业方向
 */



export interface StartupOpportunityInput {


hot:number;


trend:number;


business:number;


demand:number;


}




/**
 * 计算创业机会指数
 *
 * 权重：
 *
 * 市场热度 25%
 * 趋势增长 30%
 * 商业价值 30%
 * 用户需求 15%
 */


export function calculateStartupOpportunity({


hot,

trend,

business,

demand


}:StartupOpportunityInput){



const opportunity = Math.round(


hot * 0.25 +

trend * 0.30 +

business * 0.30 +

demand * 0.15


);



return opportunity;


}







/**
 * 判断创业机会等级
 */


export function getOpportunityLevel(

value:number

){



if(value>=90){


return {


level:"🔥 高机会",

color:"text-white",

desc:"具备较强市场潜力，适合重点关注"


}


}






if(value>=75){


return {


level:"🚀 成长机会",

color:"text-gray-300",

desc:"市场正在形成，可持续观察"


}


}






if(value>=60){


return {


level:"👀 潜在机会",

color:"text-gray-400",

desc:"需要进一步验证用户需求"


}


}






return {


level:"观察阶段",

color:"text-gray-500",

desc:"当前商业信号较弱"


}


}