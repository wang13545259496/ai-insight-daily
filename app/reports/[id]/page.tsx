import { reports } from "@/data/reports";


export default async function ReportDetailPage({

params,

}:{

params:
Promise<{
id:string
}>

}){


const {id}=await params;



const report =
reports.find(

(item)=>

item.id === Number(id)

);



if(!report){


return (

<div className="min-h-screen bg-black text-white flex items-center justify-center">

<h1>

Report Not Found

</h1>

</div>

)

}




const workflow = [

"任务启动",

"数据采集",

"信息整理",

"AI分析推理",

"观点生成",

"报告完成"

];





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

{report.type}

</span>



<span className="text-gray-400">

{report.date}

</span>


</div>







<h1 className="text-5xl font-bold mt-10">

{report.title}

</h1>







<section className="mt-10">


<h2 className="text-xl font-bold">

研究员 Agent

</h2>


<p className="text-gray-300 mt-4">

{report.author}

</p>


</section>









<section className="mt-10">


<h2 className="text-xl font-bold">

研究摘要

</h2>



<p className="text-gray-400 mt-4 leading-relaxed">

{report.summary}

</p>


</section>









<section className="mt-12">


<h2 className="text-xl font-bold">

AI Agent 执行流程

</h2>



<div className="mt-8 space-y-5">


{

workflow.map(

(step,index)=>(


<div

key={step}

className="
flex
items-center
gap-5
"


>


<div className="
w-10
h-10
rounded-full
border
border-gray-700
flex
items-center
justify-center
text-sm
">

{index+1}

</div>




<div className="
border
border-gray-800
rounded-xl
px-5
py-3
flex-1
text-gray-300
">

{step}

</div>



</div>


)


)


}



</div>


</section>









<section className="mt-12">


<h2 className="text-xl font-bold">

分析维度

</h2>



<div className="grid md:grid-cols-3 gap-5 mt-6">



<div className="
border
border-gray-800
rounded-xl
p-5
">

技术分析

</div>



<div className="
border
border-gray-800
rounded-xl
p-5
">

市场分析

</div>



<div className="
border
border-gray-800
rounded-xl
p-5
">

商业分析

</div>



</div>


</section>









<section className="mt-12">


<h2 className="text-xl font-bold">

研究标签

</h2>



<div className="flex flex-wrap gap-3 mt-5">


{

report.tags.map(

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









<section className="mt-12">


<h2 className="text-xl font-bold">

Agent 输出能力

</h2>



<div className="grid md:grid-cols-2 gap-4 mt-6">



<div className="
border
border-gray-800
rounded-xl
p-5
">

✓ 行业趋势判断

</div>



<div className="
border
border-gray-800
rounded-xl
p-5
">

✓ 企业竞争分析

</div>



<div className="
border
border-gray-800
rounded-xl
p-5
">

✓ 技术路线研究

</div>



<div className="
border
border-gray-800
rounded-xl
p-5
">

✓ 创业机会发现

</div>



</div>


</section>





</div>


</div>


</main>


)

}