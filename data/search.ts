export interface SearchItem {

  id:number;

  type:
  | "新闻"
  | "模型"
  | "工具"
  | "公司"
  | "创业机会"
  | "研究报告";


  title:string;

  keywords:string[];

  description:string;

  source:string;

  score:number;

}



export const searchData:SearchItem[] = [


{
id:1,

type:"新闻",

title:"OpenAI 发布新一代人工智能模型",

keywords:[
"OpenAI",
"GPT",
"大模型",
"人工智能"
],

description:
"OpenAI持续推进大模型能力升级，在推理、多模态和智能代理方向不断发展。",

source:
"OpenAI 官方",

score:98
},



{
id:2,

type:"模型",

title:"GPT 系列大语言模型",

keywords:[
"GPT",
"OpenAI",
"模型",
"LLM"
],

description:
"GPT系列模型代表当前人工智能大模型的重要发展方向，可用于文本生成、分析和智能助手。",

source:
"模型数据库",

score:97
},



{
id:3,

type:"模型",

title:"Google Gemini",

keywords:[
"Google",
"Gemini",
"多模态"
],

description:
"Google推出的新一代多模态人工智能模型体系。",

source:
"Google DeepMind",

score:95
},



{
id:4,

type:"公司",

title:"Anthropic",

keywords:[
"Anthropic",
"Claude",
"AI公司"
],

description:
"专注人工智能安全和大模型研发的人工智能公司。",

source:
"Anthropic",

score:92
},



{
id:5,

type:"工具",

title:"AI Agent 智能体工具",

keywords:[
"Agent",
"自动化",
"AI工具"
],

description:
"利用人工智能代理完成任务执行、工作流自动化和企业服务。",

source:
"AI工具库",

score:94
},



{
id:6,

type:"创业机会",

title:"企业 AI 智能助手",

keywords:[
"创业",
"AI Agent",
"企业服务"
],

description:
"利用AI智能体帮助企业提升办公效率、知识管理和业务自动化。",

source:
"AI机会地图",

score:96
},



{
id:7,

type:"研究报告",

title:"人工智能产业发展趋势报告",

keywords:[
"AI趋势",
"研究",
"产业"
],

description:
"分析人工智能技术发展方向、市场机会和产业变化。",

source:
"AI研究中心",

score:90
},



{
id:8,

type:"新闻",

title:"微软推进 Copilot AI 助手生态",

keywords:[
"Microsoft",
"Copilot",
"AI助手"
],

description:
"微软持续将人工智能能力融入办公软件和企业服务生态。",

source:
"Microsoft",

score:93
},



{
id:9,

type:"公司",

title:"百度文心大模型",

keywords:[
"百度",
"文心",
"大模型"
],

description:
"百度推出的大语言模型体系，应用于搜索、办公和企业服务领域。",

source:
"百度",

score:91
},



{
id:10,

type:"创业机会",

title:"AI内容生产平台",

keywords:[
"AIGC",
"内容",
"创业"
],

description:
"利用人工智能降低内容生产成本，提高创作效率。",

source:
"创业机会地图",

score:89
}


];