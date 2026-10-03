export interface Researcher {


id:number;


name:string;


role:string;


type:
"AI Agent"
|
"研究员";


focus:string[];


description:string;


ability:string[];


status:string;


}



export const researchers:Researcher[] = [



{

id:1,

name:"AI资讯分析师",

role:"AI News Analyst",

type:"AI Agent",

focus:[

"AI新闻",
"行业动态",
"公司事件"

],

description:

"负责追踪全球人工智能最新资讯，分析事件背景、影响和发展趋势。",

ability:[

"新闻采集",
"信息整理",
"趋势分析"

],

status:"在线"

},



{


id:2,

name:"AI模型研究员",

role:"AI Model Researcher",

type:"AI Agent",

focus:[

"大模型",
"多模态模型",
"开源模型"

],

description:

"研究全球主流AI模型能力变化，分析模型性能和应用方向。",

ability:[

"模型评测",
"技术分析",
"能力对比"

],

status:"在线"


},




{


id:3,

name:"AI产业分析师",

role:"AI Industry Analyst",

type:"AI Agent",

focus:[

"AI产业",
"企业战略",
"市场趋势"

],

description:

"分析人工智能产业变化，包括公司竞争、商业模式和市场机会。",

ability:[

"产业研究",
"竞争分析",
"商业分析"

],

status:"在线"


},




{


id:4,

name:"AI创业发现员",

role:"AI Startup Scout",

type:"AI Agent",

focus:[

"AI创业",
"商业机会",
"Agent生态"

],

description:

"发现人工智能领域的新创业机会，分析市场需求和商业潜力。",

ability:[

"机会发现",
"市场分析",
"项目评估"

],

status:"在线"


},




{


id:5,

name:"AI未来趋势研究员",

role:"Future AI Researcher",

type:"研究员",

focus:[

"未来趋势",
"技术预测",
"创新方向"

],

description:

"研究未来人工智能发展方向，输出长期趋势洞察报告。",

ability:[

"趋势研究",
"技术观察",
"报告生成"

],

status:"在线"


}



];