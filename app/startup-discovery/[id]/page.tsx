import { startupIdeas } from "@/data/startupIdeas";


export default async function StartupDetailPage({

params

}:{

params:Promise<{
id:string
}>

}){


const {id}=await params;


const idea = startupIdeas.find(

(item)=>

item.id===Number(id)

);



if(!idea){

return (

<main className="min-h-screen bg-black text-white p-10">

<h1 className="text-3xl font-bold">

创业机会不存在

</h1>

</main>

)

}



return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-5xl mx-auto">


<h1 className="text-5xl font-bold mb-4">

{idea.industry}

</h1>


<p className="text-gray-400 text-xl mb-10">

AI创业机会分析

</p>




<div className="space-y-8">



<div className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
">


<h2 className="text-2xl font-bold mb-3">

行业痛点

</h2>


<p className="text-gray-400 leading-8">

{idea.pain}

</p>


</div>





<div className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
">


<h2 className="text-2xl font-bold mb-3">

AI解决方案

</h2>


<p className="text-gray-400 leading-8">

{idea.solution}

</p>


</div>





<div className="
grid
md:grid-cols-2
gap-6
">



<div className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
">


<h2 className="text-xl font-bold mb-3">

推荐Agent

</h2>


<p className="text-gray-400">

{idea.agent}

</p>


</div>




<div className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
">


<h2 className="text-xl font-bold mb-3">

推荐模型

</h2>


<p className="text-gray-400">

{idea.model}

</p>


</div>


</div>





<div className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
">


<h2 className="text-2xl font-bold mb-3">

商业模式

</h2>


<p className="text-gray-400 leading-8">

{idea.business}

</p>


</div>





<div className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
">


<h2 className="text-2xl font-bold mb-3">

MVP启动方案

</h2>


<p className="text-gray-400 leading-8">

{idea.mvp}

</p>


</div>



</div>


</section>


</main>

)

}