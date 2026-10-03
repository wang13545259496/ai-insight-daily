import { agentMap } from "@/data/agentMap";


import AgentMapCard from "@/components/AgentMapCard";



export default function AgentMapPage(){



return (


<main

className="
min-h-screen
bg-black
text-white
p-10
"

>


<section

className="
max-w-7xl
mx-auto
"

>


<h1

className="
text-5xl
font-bold
mb-5
"

>

AI Agent生态地图

</h1>





<p

className="
text-gray-400
text-xl
mb-12
"

>

探索AI智能体产业方向，发现未来商业生态机会

</p>








<section>


<h2

className="
text-3xl
font-bold
mb-8
"

>

AI Agent产业分布

</h2>






<div

className="
grid
md:grid-cols-2
gap-8
"

>


{


agentMap.map(item=>(


<AgentMapCard


key={item.id}


category={item.category}


agent={item.agent}


scene={item.scene}


direction={item.direction}


description={item.description}


/>


))


}



</div>



</section>








<section


className="
mt-20
border
border-gray-800
rounded-2xl
p-8
bg-neutral-950
"

>


<h2

className="
text-3xl
font-bold
"

>

AI Agent生态趋势分析

</h2>





<p

className="
mt-5
text-gray-400
text-lg
leading-8
"

>

AI Agent正在从单一工具向企业级智能系统发展，
未来将在办公、开发、营销、客服、数据分析等领域形成完整产业生态。

</p>




</section>







</section>


</main>


)


}