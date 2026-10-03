import {

generateBusinessReport

}

from "@/lib/business/generateBusinessReport";





export default function BusinessAutoReport({

industry,

opportunity,

description

}:{

industry:string;

opportunity:string;

description:string;

}){



const report=

generateBusinessReport({

industry,

opportunity,

description

});





return (

<section className="mt-12">


<h2 className="text-3xl font-bold mb-8">

📄 AI自动生成商业报告

</h2>





<div className="grid md:grid-cols-2 gap-6">





<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

📊 市场规模分析

</h3>


<p className="mt-4 leading-8">

{report.marketSize}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

🎯 用户分析

</h3>


<p className="mt-4 leading-8">

{report.customerAnalysis}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

🤖 产品方案

</h3>


<p className="mt-4 leading-8">

{report.productPlan}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

🧭 产品路线图

</h3>


<p className="mt-4 leading-8 whitespace-pre-line">

{report.roadmap}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

💰 收入模型

</h3>


<p className="mt-4 leading-8">

{report.revenueModel}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

🚀 创业执行计划

</h3>


<p className="mt-4 leading-8">

{report.startupPlan}

</p>


</div>



</div>


</section>

)


}