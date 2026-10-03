import {
InvestmentCompany
}
from "@/data/investment";



import {
calculateInvestmentScore
}
from "./score";




export interface InvestmentReport {


overview:string;


business:string;


technology:string;


market:string;


growth:string;


risk:string;


summary:string;


}





export function generateInvestmentReport(

company:InvestmentCompany

):InvestmentReport{



const score =
calculateInvestmentScore({


businessScore:
company.businessScore,


technologyScore:
company.technologyScore,


marketScore:
company.marketScore,


growthScore:
company.growthScore,


riskScore:
100-company.riskScore


});




return {


overview:

`${company.name}属于${company.industry}领域，目前AI技术正在推动该领域快速发展。该项目综合评分为${score.total}，投资等级为${score.level}。`,




business:

`商业模式评分${company.businessScore}。该项目通过AI技术解决行业效率问题，商业化价值主要取决于客户需求、产品能力以及收入模式。`,




technology:

`技术能力评分${company.technologyScore}。核心竞争力来自AI模型能力、数据积累以及产品技术壁垒。`,




market:

`市场空间评分${company.marketScore}。该方向具备较大的应用场景，未来增长空间取决于行业渗透速度。`,




growth:

`成长能力评分${company.growthScore}。AI产业仍处于快速发展阶段，企业增长依赖产品创新和市场拓展能力。`,




risk:

`风险评分${company.riskScore}。需要持续关注技术竞争、商业落地速度以及市场变化。`,




summary:

`综合分析显示，${company.name}具备一定AI产业发展价值。当前AI投资机会主要集中在技术创新、企业应用和产业升级方向，需要持续跟踪市场变化。`

};


}