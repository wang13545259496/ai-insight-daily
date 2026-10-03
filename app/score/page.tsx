import { modelScores } from "@/data/modelScores";


export default function ScorePage(){


const ranking = modelScores.map((model)=>{


const total =
(
model.reasoning +
model.coding +
model.chinese +
model.multimodal +
model.business
) / 5;


return {

...model,

total:total.toFixed(1)

}


})
.sort(
(a,b)=>Number(b.total)-Number(a.total)
);



return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-6xl mx-auto">


<h1 className="text-4xl font-bold mb-4">

AI Model Ranking

</h1>


<p className="text-gray-400 mb-10">

全球主流AI模型综合能力评估

</p>



<div className="space-y-6">


{

ranking.map((model,index)=>(


<div

key={model.id}

className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
"

>



<div className="flex justify-between items-center mb-6">


<div>


<h2 className="text-2xl font-bold">

{index+1}. {model.name}

</h2>


</div>



<div className="text-4xl font-bold">

{model.total}

</div>



</div>



<div className="grid grid-cols-2 md:grid-cols-5 gap-4">



<div>
<p className="text-gray-500">
推理能力
</p>

<p className="text-xl">
{model.reasoning}
</p>
</div>



<div>
<p className="text-gray-500">
编程能力
</p>

<p className="text-xl">
{model.coding}
</p>
</div>




<div>
<p className="text-gray-500">
中文能力
</p>

<p className="text-xl">
{model.chinese}
</p>
</div>




<div>
<p className="text-gray-500">
多模态
</p>

<p className="text-xl">
{model.multimodal}
</p>
</div>




<div>
<p className="text-gray-500">
商业价值
</p>

<p className="text-xl">
{model.business}
</p>
</div>



</div>



</div>


))


}


</div>


</section>


</main>

)


}