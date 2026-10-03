import {

generateBusinessPlan

}

from "@/lib/business/generateBusinessPlan";





export default function BusinessPlan({

industry,

opportunity,

description

}:{

industry:string;

opportunity:string;

description:string;

}){


const plan=

generateBusinessPlan({

industry,

opportunity,

description

});





return (

<section className="mt-12">


<h2 className="text-3xl font-bold mb-8">

📘 AI创业商业计划书

</h2>




<div className="grid md:grid-cols-2 gap-6">



{

[

["项目概述",plan.overview],

["市场机会",plan.market],

["用户画像",plan.users],

["产品方案",plan.product],

["商业模式",plan.businessModel],

["竞争分析",plan.competition],

["盈利预测",plan.finance],

["发展路线",plan.roadmap],

["融资建议",plan.investment]

].map(([title,text])=>(


<div

key={title}

className="bg-gray-900 rounded-xl p-6"

>


<h3 className="text-xl font-bold">

{title}

</h3>


<p className="mt-4 leading-8 whitespace-pre-line">

{text}

</p>


</div>


))


}



</div>


</section>

)

}