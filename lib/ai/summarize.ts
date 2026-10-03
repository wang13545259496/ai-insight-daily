export interface AISummary {


summary:string;


keywords:string[];


importance:number;


}



export function generateSummary(

content:string

):AISummary{


const length = content.length;



return {


summary:

content.slice(0,200),



keywords:[

"AI",

"大模型",

"Agent",

"人工智能"

],



importance:

length > 200 ? 90 : 70


};


}