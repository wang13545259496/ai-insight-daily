export interface Report {


id:number;


title:string;


type:
"行业分析"
|
"公司研究"
|
"模型研究"
|
"创业机会";


author:string;


researcherId:number;


summary:string;


tags:string[];


date:string;


}



export const reports:Report[]=[



{


id:1,


title:"OpenAI产业影响分析报告",


type:"公司研究",


author:"AI产业分析师",


researcherId:3,


summary:

"分析OpenAI的发展战略、模型生态、商业模式以及对人工智能产业的影响。",


tags:[

"OpenAI",
"大模型",
"产业趋势"

],


date:"2026-09-24"


},





{


id:2,


title:"AI Agent创业机会研究报告",


type:"创业机会",


author:"AI创业发现员",


researcherId:4,


summary:

"研究AI Agent生态发展趋势，寻找企业服务、自动化和智能应用领域的新机会。",


tags:[

"AI Agent",
"创业",
"企业服务"

],


date:"2026-09-24"


},






{


id:3,


title:"全球大模型竞争趋势报告",


type:"模型研究",


author:"AI模型研究员",


researcherId:2,


summary:

"比较全球主流人工智能模型的发展方向、能力变化和应用场景。",


tags:[

"GPT",
"Gemini",
"Claude"

],


date:"2026-09-24"


},






{


id:4,


title:"2026人工智能产业趋势报告",


type:"行业分析",


author:"AI未来趋势研究员",


researcherId:5,


summary:

"研究人工智能未来技术演进、市场变化和产业机会。",


tags:[

"AI趋势",
"未来",
"产业"

],


date:"2026-09-24"


}



];