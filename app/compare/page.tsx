import { compareData } from "@/data/compare";


export default function ComparePage(){


const a = compareData[0];

const b = compareData[1];



const items=[

{
name:"推理能力",
a:a.scores.reasoning,
b:b.scores.reasoning
},

{
name:"编程能力",
a:a.scores.coding,
b:b.scores.coding
},

{
name:"中文能力",
a:a.scores.chinese,
b:b.scores.chinese
},

{
name:"多模态能力",
a:a.scores.multimodal,
b:b.scores.multimodal
},

{
name:"商业价值",
a:a.scores.business,
b:b.scores.business
}

]



return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-5xl mx-auto">


<h1 className="text-4xl font-bold mb-4">

AI Model Compare

</h1>


<p className="text-gray-400 mb-10">

AI模型能力横向分析

</p>



<div className="
grid
md:grid-cols-2
gap-6
mb-10
">


<div className="
border
border-gray-800
rounded-2xl
p-6
">

<h2 className="text-2xl font-bold">

{a.name}

</h2>

<p className="text-gray-400">

{a.company}

</p>

</div>



<div className="
border
border-gray-800
rounded-2xl
p-6
">


<h2 className="text-2xl font-bold">

{b.name}

</h2>


<p className="text-gray-400">

{b.company}

</p>


</div>


</div>





<div className="space-y-5">


{

items.map(item=>(


<div

key={item.name}

className="
border
border-gray-800
rounded-xl
p-5
"


>


<div className="flex justify-between mb-3">


<span>

{item.name}

</span>


<span>

{item.a} VS {item.b}

</span>


</div>



<div className="
grid
grid-cols-2
gap-4
">


<div className="
bg-neutral-900
p-3
rounded-lg
">

{a.name}

<br/>

{item.a}

</div>



<div className="
bg-neutral-900
p-3
rounded-lg
">


{b.name}

<br/>

{item.b}

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