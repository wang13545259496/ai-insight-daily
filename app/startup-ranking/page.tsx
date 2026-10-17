import { startupScores } from "@/data/startupScores";


export default function StartupRankingPage(){


const ranking = startupScores.map(item=>{


const score =

(
item.market +
item.aiPotential +
item.business

)/3;


return {

...item,

score:Number(score.toFixed(1))

}


})
.sort(
(a,b)=>b.score-a.score
);



return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-6xl mx-auto">


<h1 className="text-4xl font-bold mb-4">

AI Startup Ranking

</h1>


<p className="text-gray-400 mb-10">

AI时代创业机会综合分析排名

</p>




<div className="space-y-6">


{

ranking.map((item,index)=>(


<div

key={item.id}

className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
"


>


<div className="flex justify-between mb-6">


<h2 className="text-2xl font-bold">

{index+1}. {item.industry}

</h2>


<div className="text-4xl font-bold">

{item.score}

</div>


</div>




<div className="
grid
md:grid-cols-3
gap-6
">


<div>

<p className="text-gray-400">

市场规模

</p>

<p className="text-xl">

{item.market}

</p>

</div>



<div>

<p className="text-gray-400">

AI替代潜力

</p>

<p className="text-xl">

{item.aiPotential}

</p>

</div>



<div>

<p className="text-gray-400">

商业化能力

</p>

<p className="text-xl">

{item.business}

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