import {
BusinessOpportunity
}
from "@/data/businessOpportunity";




export interface BusinessRecommendation {


direction:string;


targetCustomer:string;


product:string;


model:string;


strategy:string;


}







export function generateBusinessRecommendation(

item:BusinessOpportunity

):BusinessRecommendation{





let direction="AI行业解决方案";

let targetCustomer="企业用户";

let product="AI智能应用";

let model="SaaS订阅";

let strategy="从垂直场景切入";






if(item.category==="AI Agent"){


direction=
"AI智能体平台";


product=
"企业级AI Agent助手";


model=
"SaaS订阅 + 定制服务";


strategy=
"选择高频业务流程，快速验证产品价值";


}






if(item.industry==="企业服务"){


targetCustomer=
"中小企业、企业管理团队";


}






if(item.industry==="教育"){


targetCustomer=
"学校、培训机构、学生用户";


product=
"AI学习助手";


model=
"会员订阅";


}






if(item.industry==="数字营销"){


targetCustomer=
"品牌企业、电商团队";


product=
"AI营销自动化平台";


model=
"SaaS服务 + 营销方案";


}






if(item.industry==="数据智能"){


direction=
"AI商业智能平台";


product=
"企业数据分析助手";


targetCustomer=
"企业管理层、数据团队";


model=
"企业软件授权";


}





return {


direction,


targetCustomer,


product,


model,


strategy


};


}