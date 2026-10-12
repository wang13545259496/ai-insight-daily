import { agents } from "@/data/agents";

export default function AgentsPage(){


return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-6xl mx-auto">


<h1 className="text-4xl font-bold mb-4">

AI Agent Market

</h1>


<p className="text-gray-400 mb-10">

全球人工智能智能体生态市场

</p>



<div className="
grid
md:grid-cols-2
lg:grid-cols-3
gap-8
">


{

agents.map(agent=>(


<div

key={agent.id}

className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
hover:border-white
transition
"


>


<h2 className="text-2xl font-bold mb-2">

{agent.name}

</h2>



<p className="text-gray-400 mb-5">

{agent.company}

</p>




<div className="
inline-block
border
border-gray-700
rounded-full
px-3
py-1
text-sm
mb-5
">

{agent.type}

</div>





<div className="flex flex-wrap gap-2 mb-6">


{

agent.tags.map(tag=>(


<span

key={tag}

className="
border
border-gray-700
px-3
py-1
rounded-full
text-sm
"

>

{tag}

</span>


))

}


</div>





<p className="text-gray-400 leading-7 mb-6">

{agent.description}

</p>





<h3 className="font-bold mb-3">

应用场景

</h3>


<ul className="text-gray-400 space-y-2 mb-6">


{

agent.scene.map(item=>(


<li key={item}>

- {item}

</li>


))

}


</ul>





<h3 className="font-bold mb-3">

商业价值

</h3>


<p className="text-gray-400">

{agent.business}

</p>



</div>


))


}


</div>


</section>


</main>

)


}