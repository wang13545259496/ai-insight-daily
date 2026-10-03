import { tools } from "@/data/tools";






export default function ToolsPage(){

return (

<main className="min-h-screen bg-black text-white">





<section className="p-8">


<h1 className="text-4xl font-bold mb-8">
AI工具库
</h1>


<div className="grid md:grid-cols-3 gap-6">


{
tools.map((tool,index)=>(


<div
key={index}
className="
border
border-gray-800
rounded-xl
p-6
hover:border-gray-500
transition
"
>


<h2 className="text-2xl font-bold">
{tool.name}
</h2>


<p className="text-gray-400 mt-2">
{tool.company}
</p>


<p className="mt-4">
{tool.description}
</p>


</div>


))
}


</div>


</section>


</main>

)

}