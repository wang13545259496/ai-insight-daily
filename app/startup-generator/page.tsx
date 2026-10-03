import { startupProjects } from "@/data/startupGenerator";


export default function StartupGeneratorPage(){

return (

<div className="min-h-screen bg-black text-white p-10">


<h1 className="text-4xl font-bold">
AI创业项目生成器
</h1>


<p className="text-gray-400 mt-3">
AI Insight Daily 创业智能分析实验室
</p>



<div className="
mt-10
border
border-gray-800
rounded-2xl
p-8
bg-gray-950
">


<h2 className="text-2xl font-bold">
输入你的创业想法
</h2>


<div className="
mt-5
border
border-gray-700
rounded-xl
p-5
text-gray-400
">

例如：阿勒泰旅游AI助手

</div>


<button
className="
mt-5
px-6
py-3
border
border-white
rounded-xl
"
>

生成创业方案

</button>


</div>





<h2 className="text-3xl font-bold mt-12">
AI创业方案
</h2>



<div className="
grid
md:grid-cols-2
gap-8
mt-8
">


{
startupProjects.map(project=>(


<div
key={project.id}
className="
border
border-gray-800
rounded-2xl
p-8
bg-gray-950
"
>


<h3 className="text-2xl font-bold">
{project.projectName}
</h3>


<p className="text-gray-400 mt-3">
方向：
{project.input}
</p>



<section className="mt-8">

<h4 className="font-bold text-xl">
目标用户
</h4>


{
project.targetUsers.map((item,index)=>(

<p
key={index}
className="text-gray-300 mt-2"
>
• {item}
</p>

))
}

</section>




<section className="mt-8">

<h4 className="font-bold text-xl">
用户痛点
</h4>


{
project.painPoints.map((item,index)=>(

<p
key={index}
className="text-gray-300 mt-2"
>
• {item}
</p>

))
}

</section>




<section className="mt-8">

<h4 className="font-bold text-xl">
产品设计
</h4>


{
project.products.map((item,index)=>(

<p
key={index}
className="text-gray-300 mt-2"
>
{index+1}. {item}
</p>

))
}

</section>




<section className="mt-8">

<h4 className="font-bold text-xl">
商业模式
</h4>


{
project.businessModels.map((item,index)=>(

<span
key={index}
className="
inline-block
border
border-gray-700
rounded-full
px-4
py-2
mr-3
mt-3
"
>

{item}

</span>

))
}

</section>




<section className="mt-8">

<h4 className="font-bold text-xl">
MVP验证方案
</h4>


{
project.mvp.map((item,index)=>(

<p
key={index}
className="text-gray-300 mt-2"
>

{index+1}. {item}

</p>

))
}


</section>




<section className="mt-8">

<h4 className="font-bold text-xl">
市场分析
</h4>


<p className="text-gray-400 mt-3 leading-8">

{project.marketAnalysis}

</p>


</section>



</div>


))

}


</div>


</div>

)

}