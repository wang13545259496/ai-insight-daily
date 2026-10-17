import { agentScores } from "@/data/agentScores";


export default function AgentScorePage(){


const ranking = agentScores.map(agent=>{


const total =
(
agent.intelligence +
agent.automation +
agent.enterprise +
agent.usability +
agent.ecosystem
) / 5;


return {

...agent,

total:Number(total.toFixed(1))

}


})
.sort(
(a,b)=>b.total-a.total
);



return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-6xl mx-auto">


<h1 className="text-4xl font-bold mb-4">

AI Agent Ranking

</h1>


<p className="text-gray-400 mb-10">

全球人工智能智能体综合能力排名

</p>




<div className="space-y-6">


{

ranking.map((agent,index)=>(


<div

key={agent.id}

className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
"

>


<div className="flex justify-between items-center mb-6">


<h2 className="text-2xl font-bold">

{index+1}. {agent.name}

</h2>


<div className="text-4xl font-bold">

{agent.total}

</div>


</div>





<div className="
grid
grid-cols-2
md:grid-cols-5
gap-5
">


<div>

<p className="text-gray-400">

智能程度

</p>

<p className="text-xl">

{agent.intelligence}

</p>

</div>



<div>

<p className="text-gray-400">

自动化能力

</p>

<p className="text-xl">

{agent.automation}

</p>

</div>




<div>

<p className="text-gray-400">

企业价值

</p>

<p className="text-xl">

{agent.enterprise}

</p>

</div>




<div>

<p className="text-gray-400">

易用程度

</p>

<p className="text-xl">

{agent.usability}

</p>

</div>




<div>

<p className="text-gray-400">

生态成熟度

</p>

<p className="text-xl">

{agent.ecosystem}

</p>

</div>



</div>



</div>


))


}


</div>


</section>


</main>

)

}