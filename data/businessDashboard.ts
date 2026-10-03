export interface BusinessDashboardItem {


id:number;


name:string;


industry:string;


score:number;


trend:string;


market:string;


}



export const businessDashboard:

BusinessDashboardItem[]=[


{

id:7,

name:"企业智能助手",

industry:"AI办公",

score:92,

trend:"高速增长",

market:"企业服务"

},



{

id:8,

name:"智能营销Agent",

industry:"AI营销",

score:88,

trend:"快速增长",

market:"企业增长"

},



{

id:9,

name:"AI学习助手",

industry:"AI教育",

score:85,

trend:"持续增长",

market:"教育科技"

}



];






export function getRank(){

return [

...businessDashboard

].sort(

(a,b)=>b.score-a.score

);

}