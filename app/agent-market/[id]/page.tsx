import Link from "next/link";


import { agentMarket } from "@/data/agentMarket";



interface PageProps {

params: Promise<{
id:string;
}>;

}



export default async function AgentDetailPage({params}:PageProps){



const {id} = await params;



const agentId = Number(id);



const agent = agentMarket.find(

item=>item.id===agentId

);





if(!agent){


return (

<main

className="
min-h-screen
bg-black
text-white
p-10
"

>

<h1

className="
text-4xl
font-bold
"

>

Agent不存在

</h1>

</main>

)

}





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
max-w-5xl
mx-auto
"

>


<Link

href="/agent-market"

className="
text-gray-400
hover:text-white
"

>

← 返回Agent市场

</Link>






<div

className="
mt-10
border
border-gray-800
rounded-2xl
p-10
bg-neutral-950
"

>



<h1

className="
text-5xl
font-bold
mb-8
"

>

{agent.name}

</h1>






<div

className="
space-y-3
text-gray-400
text-lg
"

>


<p>

分类：

{agent.category}

</p>


<p>

类型：

{agent.type}

</p>


<p>

热度：

{agent.heat}

</p>


</div>







<div className="mt-10">


<h2

className="
text-3xl
font-bold
mb-4
"

>

Agent介绍

</h2>


<p

className="
text-gray-400
text-lg
"

>

{agent.description}

</p>


</div>








<div className="mt-10">


<h2

className="
text-3xl
font-bold
mb-4
"

>

应用场景

</h2>


<p

className="
text-gray-400
text-lg
"

>

{agent.scene}

</p>


</div>








<div className="mt-10">


<h2

className="
text-3xl
font-bold
mb-4
"

>

适合用户

</h2>


<p

className="
text-gray-400
text-lg
"

>

{agent.users}

</p>


</div>








<div className="mt-10">


<h2

className="
text-3xl
font-bold
mb-4
"

>

商业价值

</h2>


<p

className="
text-gray-400
text-lg
"

>

{agent.value}

</p>


</div>







</div>


</section>


</main>


)


}