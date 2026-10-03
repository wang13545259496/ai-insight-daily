import { models } from "@/data/models";


export default async function ModelDetailPage({

params

}:{

params: Promise<{
id:string
}>

}){


const {id}=await params;


const model =
models.find(
(item)=>
item.id === Number(id)
);



if(!model){

return (

<main className="min-h-screen bg-black text-white p-10">

<h1 className="text-3xl font-bold">

模型不存在

</h1>

</main>

)

}



return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-5xl mx-auto">


<h1 className="text-5xl font-bold mb-4">

{model.name}

</h1>



<p className="text-gray-400 text-xl mb-10">

{model.company}

</p>




<div className="
border
border-gray-800
rounded-2xl
p-8
mb-8
">


<h2 className="text-2xl font-bold mb-4">

综合评分

</h2>


<div className="text-5xl font-bold">

{model.score}

</div>


</div>




<div className="space-y-8">



<div>

<h2 className="text-2xl font-bold mb-3">

模型介绍

</h2>


<p className="text-gray-400">

{model.description}

</p>

</div>




<div>

<h2 className="text-2xl font-bold mb-3">

核心能力

</h2>


<div className="flex gap-3 flex-wrap">

{
model.tags.map(tag=>(


<span

key={tag}

className="
border
border-gray-700
px-4
py-2
rounded-full
"

>

{tag}

</span>


))

}

</div>

</div>




<div>

<h2 className="text-2xl font-bold mb-3">

应用场景

</h2>


<ul className="text-gray-400">

{

model.scene.map(item=>(

<li key={item}>

- {item}

</li>

))

}

</ul>


</div>




<div>

<h2 className="text-2xl font-bold mb-3">

技术定位

</h2>


<p className="text-gray-400">

{model.technology}

</p>


</div>




<div>

<h2 className="text-2xl font-bold mb-3">

生态能力

</h2>


<p className="text-gray-400">

{model.ecosystem}

</p>


</div>



</div>



</section>


</main>


)

}