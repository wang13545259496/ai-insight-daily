import { agentGraph } from "@/data/agentGraph";


import AgentGraph from "@/components/AgentGraph";




export default function AgentGraphPage(){



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

AI Agent生态图谱

</h1>





<p


className="
text-gray-400
text-xl
mb-12
"

>

AI智能体产业关系网络 · 生态方向分析 · 商业机会探索

</p>







<AgentGraph

nodes={agentGraph}

/>







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
mb-5
"

>

AI Agent生态趋势

</h2>






<p


className="
text-gray-400
text-lg
leading-8
"

>

未来AI Agent将从单个工具发展为完整生态系统，
连接开发、办公、企业服务、营销、数据分析等多个产业方向。

</p>




</section>








</section>



</main>


)


}