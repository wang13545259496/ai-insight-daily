import { agents } from "@/data/agents";

import { agentScores } from "@/data/agentScore";

import { agentRanking } from "@/data/agentRanking";


import AgentScoreCard from "@/components/AgentScoreCard";

import AgentRankingCard from "@/components/AgentRankingCard";





export default function AgentMarketPage(){



const agentCount = agents.length;



const companyCount = new Set(

agents.map(item=>item.company)

).size;





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

AI Agent市场

</h1>



<p

className="
text-gray-400
text-xl
mb-12
"

>

AI智能体生态市场 · 发现优秀Agent应用

</p>







<section

className="
grid
md:grid-cols-3
gap-6
mb-16
"

>


<div

className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
"

>

<p className="text-gray-400">

Agent数量

</p>


<h2 className="text-4xl font-bold mt-3">

{agentCount}

</h2>


</div>






<div

className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
"

>

<p className="text-gray-400">

Agent厂商

</p>


<h2 className="text-4xl font-bold mt-3">

{companyCount}

</h2>


</div>






<div

className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
"

>

<p className="text-gray-400">

生态状态

</p>


<h2 className="text-4xl font-bold mt-3">

持续增长

</h2>


</div>



</section>









<section>


<h2

className="
text-3xl
font-bold
mb-8
"

>

Agent生态列表

</h2>





<div

className="
grid
md:grid-cols-2
gap-8
"

>


{


agents.map(agent=>(


<div

key={agent.id}

className="
border
border-gray-800
rounded-2xl
p-8
bg-neutral-950
hover:border-white
transition
"

>


<h3

className="
text-2xl
font-bold
"

>

{agent.name}

</h3>




<p

className="
text-gray-400
mt-3
"

>

{agent.company}

</p>




<p

className="
text-gray-300
mt-5
leading-7
"

>

{agent.description}

</p>




</div>


))


}



</div>



</section>









<section className="mt-20">


<h2

className="
text-3xl
font-bold
mb-8
"

>

Agent能力评分

</h2>





<div

className="
grid
md:grid-cols-2
gap-8
"

>


{


agentScores.map(item=>(


<AgentScoreCard

key={item.id}

name={item.name}

ability={item.ability}

technology={item.technology}

business={item.business}

ecosystem={item.ecosystem}

total={item.total}

level={item.level}

desc={item.desc}

/>


))


}



</div>



</section>









<section className="mt-20">


<h2

className="
text-3xl
font-bold
mb-8
"

>

Agent排行榜

</h2>





<div

className="
grid
md:grid-cols-2
gap-8
"

>


{


agentRanking.map(item=>(


<AgentRankingCard


key={item.id}


rank={item.rank}


name={item.name}


score={item.score}


trend={item.trend}


hot={item.hot}


category={item.category}


desc={item.desc}


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

AI Agent市场分析中心

</h2>



<p

className="
text-gray-400
mt-5
leading-8
"

>

通过Agent生态数量、厂商分布、能力评分和排行榜，
发现AI智能体的发展方向。

</p>



</section>







</section>


</main>


)


}