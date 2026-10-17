import Link from "next/link";
import { researchers } from "@/data/researchers";


export default function ResearchPage(){


return (

<main className="min-h-screen bg-black text-white px-8 py-16">


<div className="max-w-6xl mx-auto">



<h1 className="text-5xl font-bold">

AI Research Team

</h1>



<p className="mt-5 text-xl text-gray-400">

全球人工智能研究智能体团队

</p>




<div className="grid md:grid-cols-2 gap-8 mt-14">



{

researchers.map((agent)=>(


<Link

href={`/research/${agent.id}`}

key={agent.id}

className="
block
"


>



<div

className="
border
border-gray-800
rounded-3xl
p-8
bg-gray-950
hover:border-gray-500
transition
cursor-pointer
"


>



<div className="flex justify-between items-center">


<h2 className="text-2xl font-bold">

{agent.name}

</h2>



<span className="
text-sm
px-3
py-1
rounded-full
border
border-gray-700
text-gray-300
">

{agent.status}

</span>



</div>





<p className="text-gray-400 mt-2">

{agent.role}

</p>




<p className="text-gray-300 mt-6 leading-relaxed">

{agent.description}

</p>





<div className="mt-6">


<h3 className="text-sm text-gray-400 mb-3">

研究方向

</h3>



<div className="flex flex-wrap gap-2">


{

agent.focus.map((item)=>(


<span

key={item}

className="
px-3
py-1
rounded-full
bg-gray-900
border
border-gray-800
text-sm
"

>

{item}

</span>


))


}


</div>


</div>





<div className="mt-6">


<h3 className="text-sm text-gray-400 mb-3">

核心能力

</h3>



<ul className="space-y-2">


{

agent.ability.map((item)=>(


<li

key={item}

className="text-gray-300"

>

✓ {item}

</li>


))


}


</ul>


</div>




<div className="mt-8 text-sm text-gray-400">

查看研究员详情 →

</div>



</div>


</Link>



))


}



</div>



</div>


</main>


)


}