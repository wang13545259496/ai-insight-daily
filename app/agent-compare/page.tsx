import { agentCompare } from "@/data/agentCompare";


export default function AgentComparePage(){


const a = agentCompare[0];

const b = agentCompare[1];



const items = [

{
name:"智能程度",
a:a.scores.intelligence,
b:b.scores.intelligence
},


{
name:"自动化能力",
a:a.scores.automation,
b:b.scores.automation
},


{
name:"企业价值",
a:a.scores.enterprise,
b:b.scores.enterprise
},


{
name:"易用程度",
a:a.scores.usability,
b:b.scores.usability
},


{
name:"生态成熟度",
a:a.scores.ecosystem,
b:b.scores.ecosystem
}


];



return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-5xl mx-auto">


<h1 className="text-4xl font-bold mb-4">

AI Agent Compare

</h1>


<p className="text-gray-400 mb-10">

智能体能力横向分析

</p>




<div className="
grid
md:grid-cols-2
gap-6
mb-10
">


<div className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
">


<h2 className="text-2xl font-bold">

{a.name}

</h2>


<p className="text-gray-400">

{a.company}

</p>


</div>




<div className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
">


<h2 className="text-2xl font-bold">

{b.name}

</h2>


<p className="text-gray-400">

{b.company}

</p>


</div>


</div>





<div className="space-y-5">


{

items.map(item=>(


<div

key={item.name}

className="
border
border-gray-800
rounded-xl
p-5
"


>


<div className="
flex
justify-between
mb-4
">


<h3 className="font-bold">

{item.name}

</h3>


<div>

{item.a}

&nbsp; VS &nbsp;

{item.b}

</div>


</div>





<div className="
grid
grid-cols-2
gap-4
">


<div className="
bg-neutral-900
rounded-lg
p-4
">


<p className="text-gray-400">

{a.name}

</p>


<p className="text-2xl font-bold">

{item.a}

</p>


</div>




<div className="
bg-neutral-900
rounded-lg
p-4
">


<p className="text-gray-400">

{b.name}

</p>


<p className="text-2xl font-bold">

{item.b}

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