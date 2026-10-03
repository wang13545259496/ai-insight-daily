import { agentDashboard } from "@/data/agentDashboard";


import AgentDashboardStats from "@/components/AgentDashboardStats";

import AgentCategoryChart from "@/components/AgentCategoryChart";

import AgentTrendChart from "@/components/AgentTrendChart";




export default function AgentDashboardPage(){



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

AI Agent生态驾驶舱

</h1>





<p


className="
text-gray-400
text-xl
mb-12
"


>

AI智能体产业分析中心 · 市场趋势 · 商业机会洞察

</p>








{/* 核心指标 */}


<section>


<AgentDashboardStats


totalAgents={agentDashboard.totalAgents}


industryCount={agentDashboard.categories.length}


opportunityCount={agentDashboard.opportunities.length}


hotDirection={agentDashboard.hotDirection}


/>


</section>









{/* 行业分布 */}


<section


className="
mt-16
"


>


<AgentCategoryChart


categories={agentDashboard.categories}


/>


</section>









{/* 趋势分析 */}


<section


className="
mt-16
"


>


<AgentTrendChart


trend={agentDashboard.trend}


/>


</section>









{/* 商业机会 */}


<section


className="
mt-16
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

AI Agent商业机会分析

</h2>





<div


className="
grid
md:grid-cols-3
gap-6
"


>


{


agentDashboard.opportunities.map(item=>(


<div


key={item.name}


className="
border
border-gray-700
rounded-xl
p-5
"


>


<h3


className="
text-xl
font-bold
"


>

{item.name}

</h3>



<p


className="
text-gray-400
mt-3
"


>

机会指数：

{item.value}

</p>



</div>


))


}



</div>




</section>









<section


className="
mt-16
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

AI Agent智能分析中心

</h2>



<p


className="
text-gray-400
mt-5
leading-8
"


>

通过Agent数量、行业分布、发展趋势和商业机会模型，
持续分析AI智能体生态变化。

</p>



</section>







</section>


</main>


)


}