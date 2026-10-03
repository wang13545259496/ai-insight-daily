import Link from "next/link";

import { models } from "@/data/models";


export default function ComparePage(){


const compareModels = models.slice(0,3);



return (

<main

className="
min-h-screen
bg-black
text-white
p-8
"

>


<div

className="
max-w-7xl
mx-auto
"

>



<Link

href="/models"

className="
text-gray-400
hover:text-white
"

>

← 返回模型库

</Link>





<h1

className="
text-5xl
font-bold
mt-10
"

>

AI模型对比中心

</h1>



<p

className="
mt-4
text-gray-400
text-lg
"

>

比较全球主流人工智能模型能力

</p>







<section

className="
mt-12
overflow-x-auto
"

>


<table

className="
w-full
border
border-zinc-800
rounded-xl
overflow-hidden
"

>


<thead>


<tr

className="
bg-zinc-950
"

>


<th

className="
p-5
text-left
"

>

指标

</th>


{

compareModels.map(model=>(


<th

key={model.id}

className="
p-5
text-center
"

>

{model.name}

</th>


))


}


</tr>


</thead>







<tbody>



<tr

className="
border-t
border-zinc-800
"

>


<td

className="
p-5
text-gray-400
"

>

公司

</td>


{

compareModels.map(model=>(


<td

key={model.id}

className="
p-5
text-center
"

>

{model.company}

</td>


))


}


</tr>








<tr

className="
border-t
border-zinc-800
"

>


<td

className="
p-5
text-gray-400
"

>

模型类型

</td>


{

compareModels.map(model=>(


<td

key={model.id}

className="
p-5
text-center
"

>

{model.type}

</td>


))


}


</tr>








<tr

className="
border-t
border-zinc-800
"

>


<td

className="
p-5
text-gray-400
"

>

综合评分

</td>


{

compareModels.map(model=>(


<td

key={model.id}

className="
p-5
text-center
text-green-400
font-bold
text-xl
"

>

{model.score}

</td>


))


}


</tr>








<tr

className="
border-t
border-zinc-800
"

>


<td

className="
p-5
text-gray-400
"

>

开源状态

</td>


{

compareModels.map(model=>(


<td

key={model.id}

className="
p-5
text-center
"

>


{

model.opensource

?

"开源"

:

"闭源"

}


</td>


))


}


</tr>







<tr

className="
border-t
border-zinc-800
"

>


<td

className="
p-5
text-gray-400
"

>

核心能力

</td>


{

compareModels.map(model=>(


<td

key={model.id}

className="
p-5
"

>


<div

className="
space-y-2
"

>


{

model.abilities.map(item=>(


<div

key={item}

className="
text-sm
"

>

✓ {item}

</div>


))


}


</div>


</td>


))


}


</tr>






</tbody>



</table>


</section>








<section

className="
mt-12
grid
md:grid-cols-3
gap-6
"

>


{

compareModels.map(model=>(


<Link

key={model.id}

href={`/models/${model.id}`}

className="
bg-zinc-950
border
border-zinc-800
rounded-xl
p-6
hover:border-white
transition
"

>


<h2

className="
text-2xl
font-bold
"

>

{model.name}

</h2>



<p

className="
mt-3
text-gray-400
"

>

查看详细分析 →

</p>


</Link>


))


}


</section>





</div>


</main>


)

}