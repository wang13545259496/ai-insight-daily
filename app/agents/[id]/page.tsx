import { agents } from "@/data/agents";


export default async function AgentDetailPage({

params

}:{

params:Promise<{
id:string
}>

}){


const {id}=await params;


const agent =
agents.find(
(item)=>
item.id===Number(id)
);



if(!agent){

return (

<main className="min-h-screen bg-black text-white p-10">

<h1 className="text-3xl font-bold">

Agent不存在

</h1>

</main>

)

}



return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-5xl mx-auto">


<h1 className="text-5xl font-bold mb-4">

{agent.name}

</h1>


<p className="text-gray-400 text-xl mb-10">

{agent.company}

</p>




<div className="
border
border-gray-800
rounded-2xl
p-8
bg-neutral-950
mb-8
">


<h2 className="text-2xl font-bold mb-4">

Agent类型

</h2>


<p className="text-gray-400">

{agent.type}

</p>


</div>





<div className="space-y-8">


<div>

<h2 className="text-2xl font-bold mb-3">

能力标签

</h2>


<div className="flex flex-wrap gap-3">


{

agent.tags.map(tag=>(


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

Agent介绍

</h2>


<p className="text-gray-400 leading-8">

{agent.description}

</p>


</div>





<div>

<h2 className="text-2xl font-bold mb-3">

应用场景

</h2>


<ul className="text-gray-400 space-y-2">


{

agent.scene.map(item=>(


<li key={item}>

- {item}

</li>


))

}


</ul>


</div>





<div>

<h2 className="text-2xl font-bold mb-3">

基础模型

</h2>


<p className="text-gray-400">

{agent.model}

</p>


</div>





<div>

<h2 className="text-2xl font-bold mb-3">

商业价值

</h2>


<p className="text-gray-400">

{agent.business}

</p>


</div>





<div>

<h2 className="text-2xl font-bold mb-3">

生态能力

</h2>


<p className="text-gray-400">

{agent.ecosystem}

</p>


</div>


</div>



</section>


</main>


)

}