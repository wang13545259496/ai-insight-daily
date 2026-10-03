import { agentRanking } from "@/data/agentRanking";


import AgentRankingCard from "@/components/AgentRankingCard";



export default function AgentRankingPage(){



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
max-w-6xl
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

🔥 AI Agent热度排行榜

</h1>




<p

className="
text-gray-400
text-xl
mb-12
"

>

发现当前最受关注的AI智能体

</p>






<div

className="
space-y-8
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


</main>


)


}