export interface BusinessRecommendation {


businessId:number;


startupDirection:string;


targetCustomer:string;


productEntry:string;


growthPath:string;


}





export const businessRecommendations:

BusinessRecommendation[]=[



{


businessId:7,


startupDirection:

"打造企业级AI Agent助手，为中小企业提供智能办公自动化服务。",


targetCustomer:

"中小企业、物业公司、教育机构、制造企业、服务行业。",


productEntry:

"从AI知识库、智能客服、自动文档生成、流程自动化切入。",


growthPath:

`第一阶段：单行业AI助手。

第二阶段：企业工作流自动化。

第三阶段：构建行业AI智能体生态。`


},





{


businessId:8,


startupDirection:

"打造AI营销智能体，帮助企业降低获客成本。",


targetCustomer:

"电商企业、品牌企业、销售团队、中小创业公司。",


productEntry:

"AI内容生成、客户分析、销售自动化。",


growthPath:

`第一阶段：AI营销工具。

第二阶段：客户增长智能平台。

第三阶段：企业营销Agent生态。`


},





{


businessId:9,


startupDirection:

"开发个性化AI学习助手，提供智能教育服务。",


targetCustomer:

"学生、培训机构、职业教育企业。",


productEntry:

"AI答疑、学习规划、知识图谱。",


growthPath:

`第一阶段：AI学习辅助工具。

第二阶段：个性化学习系统。

第三阶段：AI教育智能平台。`


}



];






export function getBusinessRecommendation(

id:number

){


return businessRecommendations.find(

item=>item.businessId===id

);


}