import Link from "next/link";


import {
  businessOpportunityData
} from "@/data/businessOpportunity";


import {
  calculateBusinessScore
}
from "@/lib/businessScore";


import {
  getBusinessRanking
}
from "@/lib/businessRanking";





export default function BusinessPage(){



const ranking =
getBusinessRanking();




return (


<main
className="
min-h-screen
bg-black
text-white
px-8
py-12
"
>


<section
className="
max-w-7xl
mx-auto
"
>





{/* 标题 */}


<div className="mb-12">


<h1
className="
text-4xl
font-bold
mb-4
"
>

AI商业机会智能中心

</h1>


<p
className="
text-gray-400
text-lg
"
>

基于市场规模、增长趋势、企业需求和商业成熟度，
智能发现未来AI商业机会。

</p>


</div>









{/* 排行榜 */}


<section
className="
border
border-gray-800
rounded-2xl
p-8
mb-12
"
>


<h2
className="
text-2xl
font-bold
mb-6
"
>

🏆 AI商业机会排行榜

</h2>





<div className="space-y-5">


{

ranking
.slice(0,5)
.map(

(item,index)=>(


<div

key={item.id}

className="
flex
justify-between
items-center
border-b
border-gray-800
pb-5
"

>


<div>


<h3
className="
text-xl
font-bold
"
>

NO.{index+1}

&nbsp;

{item.title}

</h3>



<p
className="
text-gray-400
mt-2
"
>

{item.industry}

&nbsp; · &nbsp;

{item.category}

</p>


</div>





<div className="text-right">


<p
className="
text-3xl
font-bold
"
>

{item.rankingScore}

</p>



<p
className="
text-gray-400
"
>

{item.level}

</p>


</div>


</div>


)


)

}


</div>



</section>









{/* 数据概览 */}


<div
className="
grid
md:grid-cols-4
gap-6
mb-12
"
>



<div
className="
border
border-gray-800
rounded-xl
p-6
"
>

<p className="text-gray-400">

机会数量

</p>


<h2 className="text-3xl font-bold mt-3">

{
businessOpportunityData.length
}

</h2>


</div>








<div
className="
border
border-gray-800
rounded-xl
p-6
"
>


<p className="text-gray-400">

最高机会指数

</p>



<h2 className="text-3xl font-bold mt-3">

{
ranking[0]?.rankingScore
}

</h2>


</div>








<div
className="
border
border-gray-800
rounded-xl
p-6
"
>


<p className="text-gray-400">

热门方向

</p>


<h2
className="
text-xl
font-bold
mt-3
"
>

AI Agent

</h2>


</div>








<div
className="
border
border-gray-800
rounded-xl
p-6
"
>


<p className="text-gray-400">

重点行业

</p>


<h2
className="
text-xl
font-bold
mt-3
"
>

企业服务

</h2>


</div>



</div>









{/* 商业机会列表 */}



<h2
className="
text-2xl
font-bold
mb-6
"
>

🔥 全部商业机会

</h2>





<div
className="
grid
md:grid-cols-2
gap-8
"
>


{


businessOpportunityData.map(

(item)=>{


const score =

calculateBusinessScore({

marketSize:item.marketSize,

growthRate:item.growthRate,

enterpriseDemand:item.enterpriseDemand,

maturity:item.maturityScore

});





return (

<div

key={item.id}

className="
border
border-gray-800
rounded-2xl
p-8
hover:border-white
transition
"

>



<div
className="
flex
justify-between
items-start
"
>


<h3
className="
text-2xl
font-bold
"
>

{item.title}

</h3>



<div
className="
border
border-gray-700
rounded-full
px-4
py-2
"
>

指数 {score}

</div>


</div>







<div
className="
mt-6
space-y-3
text-gray-300
"
>


<p>

行业：
{item.industry}

</p>


<p>

方向：
{item.category}

</p>


<p>

增长：
{item.growth}

</p>


<p>

成熟度：
{item.maturity}

</p>


</div>







<p
className="
mt-6
text-gray-400
"
>

{item.recommendation}

</p>





<Link

href={`/business/${item.id}`}

className="
inline-block
mt-6
border
border-gray-700
px-5
py-2
rounded-lg
hover:bg-white
hover:text-black
transition
"

>

查看商业分析

</Link>



</div>


)


}


)


}



</div>









{/* 商业机会矩阵 */}


<section className="mt-16">


<h2
className="
text-2xl
font-bold
mb-6
"
>

📊 AI商业机会矩阵

</h2>




<div
className="
grid
md:grid-cols-3
gap-6
"
>


<div
className="
border
border-gray-800
rounded-xl
p-6
"
>

<h3 className="text-xl font-bold">

企业服务

</h3>


<p className="mt-3 text-gray-400">

★★★★★

</p>


<p className="mt-3">

AI助手、企业自动化、知识管理

</p>


</div>






<div
className="
border
border-gray-800
rounded-xl
p-6
"
>

<h3 className="text-xl font-bold">

数据智能

</h3>


<p className="mt-3 text-gray-400">

★★★★★

</p>


<p className="mt-3">

AI分析、商业决策、数据洞察

</p>


</div>






<div
className="
border
border-gray-800
rounded-xl
p-6
"
>

<h3 className="text-xl font-bold">

数字营销

</h3>


<p className="mt-3 text-gray-400">

★★★★☆

</p>


<p className="mt-3">

AI内容生成、智能营销

</p>


</div>


</div>


</section>









{/* 创业方向 */}


<section
className="
mt-16
"
>


<h2
className="
text-2xl
font-bold
mb-6
"
>

🚀 创业方向推荐

</h2>




<div
className="
border
border-gray-800
rounded-xl
p-8
"
>


<ul
className="
space-y-4
text-gray-300
"
>


<li>
01. 企业级 AI Agent 平台
</li>


<li>
02. 垂直行业智能助手
</li>


<li>
03. AI商业数据分析服务
</li>


<li>
04. 传统行业AI数字化升级
</li>


</ul>


</div>


</section>







</section>


</main>


)


}