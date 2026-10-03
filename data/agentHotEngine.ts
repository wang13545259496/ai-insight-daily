export interface AgentHotInput {


score:number;

search:number;

news:number;

usage:number;

growth:number;


}



export function calculateAgentHot({

score,

search,

news,

usage,

growth


}:AgentHotInput){



const result = Math.round(

score * 0.35 +

search * 0.2 +

news * 0.15 +

usage * 0.2 +

growth * 0.1

);



return result;


}






export function getAgentHotLevel(value:number){



if(value >= 90){

return {

level:"🔥 热门",

color:"text-white",

desc:"当前市场关注度极高"

}

}



if(value >=75){

return {

level:"🚀 上升",

color:"text-gray-300",

desc:"生态增长趋势明显"

}

}



return {

level:"稳定",

color:"text-gray-500",

desc:"保持正常发展"

}


}