export interface OpportunityItem {


id:number;

name:string;

industry:string;

market:string;

description:string;


demand:number;

technology:number;

competition:number;

businessValue:number;

growth:number;


users:string;

business:string;

difficulty:string;

potential:string;


}



function calculateScore(item:OpportunityItem){


return Math.round(

item.demand*0.3
+
item.technology*0.2
+
item.businessValue*0.3
+
item.growth*0.2

);


}



export const opportunities=[


{
id:1,

name:"AI企业助手",

industry:"企业服务",

market:"办公自动化",

description:
"利用AI Agent帮助企业完成流程自动化、知识管理和智能办公。",

demand:95,

technology:85,

competition:65,

businessValue:90,

growth:92,

users:"企业管理者、中小企业",

business:"AI SaaS订阅",

difficulty:"中等",

potential:"高"

},



{
id:2,

name:"AI知识库",

industry:"企业数字化",

market:"知识管理",

description:
"帮助企业构建内部智能搜索和知识问答系统。",

demand:88,

technology:90,

competition:60,

businessValue:85,

growth:86,

users:"企业员工、团队组织",

business:"软件服务",

difficulty:"较低",

potential:"高"

},



{
id:3,

name:"AI内容生产",

industry:"内容产业",

market:"营销、电商",

description:
"利用AI提升内容创作和商业运营效率。",

demand:85,

technology:88,

competition:75,

businessValue:82,

growth:80,

users:"企业、自媒体、电商",

business:"工具订阅",

difficulty:"较低",

potential:"中高"

}


].map(item=>(

{

...item,

score:calculateScore(item)

}

));
export function getOpportunityLevel(score:number){

if(score>=90){

return "★★★★★ 极高机会";

}


if(score>=80){

return "★★★★ 高机会";

}


return "★★★ 潜力机会";


}