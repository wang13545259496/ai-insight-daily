export interface Score {


market:number;


technology:number;


competition:number;


commercial:number;


total:number;


}



export interface OpportunityScore {


id:number;


name:string;


score:Score;


analysis:string;


}



export const opportunityScores:OpportunityScore[]=[



{


id:1,


name:"AI企业智能助手",


score:{


market:95,


technology:92,


competition:85,


commercial:90,


total:91



},


analysis:

"企业数字化需求增长，AI Agent技术成熟，具备较强商业落地空间。"


},






{


id:2,


name:"AI内容生产平台",


score:{


market:92,


technology:95,


competition:75,


commercial:93,


total:89



},


analysis:

"生成式AI降低内容生产成本，但市场竞争较为激烈。"


},







{


id:3,


name:"AI个性化学习助手",


score:{


market:90,


technology:88,


competition:82,


commercial:86,


total:87



},


analysis:

"教育智能化需求持续增长，需要结合专业内容体系。"


},







{


id:4,


name:"AI健康管理助手",


score:{


market:93,


technology:85,


competition:80,


commercial:82,


total:85



},


analysis:

"健康管理市场规模较大，但行业进入需要较高专业能力。"


},







{


id:5,


name:"AI开发助手平台",


score:{


market:94,


technology:96,


competition:78,


commercial:92,


total:92



},


analysis:

"开发者工具市场快速变化，AI Coding具有较强增长潜力。"


},







{


id:6,


name:"AI行业解决方案",


score:{


market:96,


technology:90,


competition:86,


commercial:88,


total:90



},


analysis:

"传统行业AI升级需求明显，需要行业资源和交付能力。"


}



];