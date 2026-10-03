export interface InvestmentCompany {

id:number;

name:string;

industry:string;

businessScore:number;

technologyScore:number;

marketScore:number;

growthScore:number;

riskScore:number;

summary:string;

analysis:string;

}



export const investmentCompanies:InvestmentCompany[]=[

{
id:1,

name:"AI企业助手",

industry:"AI企业服务",

businessScore:87,

technologyScore:85,

marketScore:90,

growthScore:92,

riskScore:35,

summary:
"利用AI Agent帮助企业完成办公自动化、知识管理和流程优化。",

analysis:
"企业智能助手正在成为AI商业应用的重要方向，未来价值取决于技术能力、客户规模以及商业化能力。"

},


{
id:2,

name:"AI智能客服",

industry:"AI客服",

businessScore:84,

technologyScore:80,

marketScore:85,

growthScore:86,

riskScore:42,

summary:
"通过大模型提升企业客服效率。",

analysis:
"智能客服正在从传统自动回复向AI Agent升级。"

},


{
id:3,

name:"AI工业智能平台",

industry:"工业AI",

businessScore:91,

technologyScore:93,

marketScore:89,

growthScore:88,

riskScore:30,

summary:
"AI赋能工业生产，提高制造效率。",

analysis:
"工业AI需要长期行业数据积累形成竞争壁垒。"

}

];