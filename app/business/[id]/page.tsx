import Link from "next/link";
import BusinessRecommendation from "@/components/BusinessRecommendation";
import { prisma } from "@/lib/prisma";
import BusinessAutoReport from "@/components/BusinessAutoReport";
import BusinessPlan from "@/components/BusinessPlan";
import {
  businessScores,
  calculateBusinessScore
} from "@/data/businessScore";


import BusinessRadar from "@/components/BusinessRadar";



export default async function BusinessDetailPage({

params,

}:{

params:Promise<{id:string}>

}){


const {id}=await params;



const opportunity = await prisma.businessOpportunity.findUnique({

where:{

id:Number(id)

},

include:{

 BusinessReport:true

}

});





if(!opportunity){


return (

<main className="min-h-screen bg-black text-white p-10">


<h1 className="text-3xl font-bold">

商业机会不存在

</h1>



<Link

href="/business"

className="text-blue-400 mt-6 block"

>

返回商业机会中心

</Link>


</main>

)


}





const report = opportunity.BusinessReport[0];





const scoreData =

businessScores.find(

(item)=>item.businessId===opportunity.id

);





const totalScore = scoreData

?

calculateBusinessScore(scoreData)

:

0;






return (

<main className="min-h-screen bg-black text-white px-8 py-12">


<div className="max-w-6xl mx-auto">





<Link

href="/business"

className="text-gray-400 hover:text-white"

>

← 返回商业机会中心

</Link>







{/* 商业机会信息 */}



<section className="mt-8 border border-gray-800 rounded-2xl p-8">



<h1 className="text-4xl font-bold">

{opportunity.opportunity}

</h1>




<p className="text-gray-400 text-lg mt-4">

行业：

{opportunity.industry}

</p>





<p className="mt-6 leading-8">

{opportunity.description}

</p>






<div className="grid md:grid-cols-3 gap-6 mt-8">





<div className="bg-gray-900 rounded-xl p-6">


<p className="text-gray-400">

发展趋势

</p>


<h3 className="text-xl mt-3">

{opportunity.trend}

</h3>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<p className="text-gray-400">

商业方向

</p>



<h3 className="text-xl mt-3">

{opportunity.direction}

</h3>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<p className="text-gray-400">

AI机会指数

</p>



<h3 className="text-3xl font-bold mt-3">

{totalScore}

<span className="text-lg">

/100

</span>

</h3>


</div>





</div>



</section>









{/* 雷达图 */}



{

scoreData &&


<section className="mt-12">


<BusinessRadar

market={scoreData.market}

technology={scoreData.technology}

profit={scoreData.profit}

competition={scoreData.competition}

difficulty={scoreData.difficulty}

/>


</section>


}









{/* 五维评分 */}



{

scoreData &&


<section className="mt-12">


<h2 className="text-3xl font-bold mb-8">

📈 AI商业机会评分模型

</h2>




<div className="grid md:grid-cols-5 gap-5">





<div className="bg-gray-900 rounded-xl p-6">

<p className="text-gray-400">

市场机会

</p>


<h3 className="text-3xl mt-3">

{scoreData.market}

</h3>


</div>







<div className="bg-gray-900 rounded-xl p-6">

<p className="text-gray-400">

技术成熟度

</p>


<h3 className="text-3xl mt-3">

{scoreData.technology}

</h3>


</div>







<div className="bg-gray-900 rounded-xl p-6">

<p className="text-gray-400">

盈利潜力

</p>


<h3 className="text-3xl mt-3">

{scoreData.profit}

</h3>


</div>







<div className="bg-gray-900 rounded-xl p-6">

<p className="text-gray-400">

竞争压力

</p>


<h3 className="text-3xl mt-3">

{scoreData.competition}

</h3>


</div>







<div className="bg-gray-900 rounded-xl p-6">

<p className="text-gray-400">

创业难度

</p>


<h3 className="text-3xl mt-3">

{scoreData.difficulty}

</h3>


</div>





</div>


</section>


}









{/* AI商业报告 */}




{

report &&


<section className="mt-12">


<h2 className="text-3xl font-bold mb-8">

🤖 AI商业机会智能报告

</h2>





<div className="grid md:grid-cols-2 gap-6">





<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

📊 市场分析

</h3>


<p className="mt-4 leading-8">

{report.marketAnalysis}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

📌 用户痛点

</h3>


<p className="mt-4 leading-8">

{report.painPoints}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

🤖 AI解决方案

</h3>


<p className="mt-4 leading-8">

{report.aiSolution}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

🧩 产品设计

</h3>


<p className="mt-4 leading-8">

{report.productDesign}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

💰 商业模式

</h3>


<p className="mt-4 leading-8">

{report.businessModel}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

⚠️ 风险分析

</h3>


<p className="mt-4 leading-8">

{report.riskAnalysis}

</p>


</div>




</div>







<div className="mt-10 bg-gray-900 rounded-xl p-8">


<h2 className="text-2xl font-bold">

🚀 AI创业建议

</h2>

<BusinessRecommendation

businessId={opportunity.id}

/>
<BusinessAutoReport

industry={opportunity.industry}

opportunity={opportunity.opportunity}

description={opportunity.description}

/>
<BusinessPlan

industry={opportunity.industry}

opportunity={opportunity.opportunity}

description={opportunity.description}

/>

<p className="mt-5 leading-8">

{report.startupAdvice}

</p>



</div>



</section>


}







</div>


</main>

)


}