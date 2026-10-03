export interface SummaryResult {


background:string;

summary:string;

}



export function summarizeNews(
content:string
):SummaryResult{


const background =
"该事件属于人工智能产业发展动态，涉及技术创新、产品升级或行业变化。";



const summary =
content.length>150
?
content.substring(0,150)+"..."
:
content;



return {


background,

summary


};


}