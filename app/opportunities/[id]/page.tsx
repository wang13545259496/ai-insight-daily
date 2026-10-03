import { opportunities } from "@/data/opportunities";
import { opportunityScores } from "@/data/scoring";



export default async function OpportunityDetailPage({

params,

}:{

params:
Promise<{
id:string
}>

}){


const {id}=await params;



const opportunity =

opportunities.find(

(item)=>

item.id === Number(id)

);



const scoreData =

opportunityScores.find(

(item)=>

item.id === Number(id)

);





if(!opportunity){


return (

<div className="min-h-screen bg-black text-white flex items-center justify-center">

<h1>

Opportunity Not Found

</h1>

</div>

)

}





return (

<main className="min-h-screen bg-black text-white px-8 py-16">


<div className="max-w-5xl mx-auto">



<div className="
border
border-gray-800
rounded-3xl
p-10
bg-gray-950
">





<div className="flex justify-between items-center">


<span className="
px-4
py-2
rounded-full
border
border-gray-700
text-gray-300
">

{opportunity.industry}

</span>



<div className="text-gray-300">

创业指数：

<span className="text-3xl font-bold">

{scoreData?.score.total}

</span>

</div>


</div>







<h1 className="text-5xl font-bold mt-10">

🚀 {opportunity.title}

</h1>







<section className="mt-10">


<h2 className="text-xl font-bold">

机会概述

</h2>


<p className="text-gray-400 mt-4 leading-relaxed">

{opportunity.description}

</p>


</section>







<section className="mt-12">


<h2 className="text-xl font-bold">

AI创业评分模型

</h2>



<div className="grid md:grid-cols-2 gap-5 mt-6">



<div className="
border
border-gray-800
rounded-xl
p-5
">


市场规模


<p className="text-3xl font-bold mt-3">

{scoreData?.score.market}

</p>


</div>





<div className="
border
border-gray-800
rounded-xl
p-5
">


技术成熟度


<p className="text-3xl font-bold mt-3">

{scoreData?.score.technology}

</p>


</div>





<div className="
border
border-gray-800
rounded-xl
p-5
">


竞争环境


<p className="text-3xl font-bold mt-3">

{scoreData?.score.competition}

</p>


</div>





<div className="
border
border-gray-800
rounded-xl
p-5
">


商业化能力


<p className="text-3xl font-bold mt-3">

{scoreData?.score.commercial}

</p>


</div>



</div>


</section>








<section className="mt-12">


<h2 className="text-xl font-bold">

AI机会分析

</h2>



<p className="text-gray-400 mt-5 leading-relaxed">

{scoreData?.analysis}

</p>


</section>







<section className="mt-12">


<h2 className="text-xl font-bold">

市场分析

</h2>


<div className="mt-5 space-y-3 text-gray-300">


<p>

目标市场：

{opportunity.market}

</p>



<p>

发展趋势：

{opportunity.trend}

</p>


</div>


</section>







<section className="mt-10">


<h2 className="text-xl font-bold">

商业模式

</h2>



<div className="
mt-5
border
border-gray-800
rounded-xl
p-5
text-gray-300
">

{opportunity.businessModel}

</div>


</section>







<section className="mt-12">


<h2 className="text-xl font-bold">

MVP启动方案

</h2>



<div className="mt-6 space-y-4">


<div className="
border
border-gray-800
rounded-xl
p-5
">

01 用户需求调研

</div>



<div className="
border
border-gray-800
rounded-xl
p-5
">

02 开发最小可用版本

</div>



<div className="
border
border-gray-800
rounded-xl
p-5
">

03 用户验证与商业测试

</div>



</div>


</section>







<section className="mt-12">


<h2 className="text-xl font-bold">

创业标签

</h2>



<div className="flex flex-wrap gap-3 mt-5">


{

opportunity.tags.map(

(tag)=>(


<span

key={tag}

className="
px-4
py-2
rounded-full
bg-gray-900
border
border-gray-800
"

>

#{tag}

</span>


)


)


}



</div>


</section>





</div>


</div>


</main>


)


}