import { researchTeam } from "@/data/researchTeam";


export default function ResearchTeamPage(){


return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-6xl mx-auto">


<h1 className="text-5xl font-bold mb-4">

AI Research Team

</h1>


<p className="text-gray-400 text-xl mb-12">

你的AI虚拟研究团队

</p>




<div className="
grid
md:grid-cols-2
gap-8
">


{

researchTeam.map(member=>(


<div

key={member.id}

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


<div className="text-5xl mb-5">

{member.icon}

</div>



<h2 className="text-2xl font-bold mb-2">

{member.name}

</h2>



<p className="text-gray-400 mb-5">

{member.role}

</p>




<p className="text-gray-400 leading-8 mb-6">

{member.description}

</p>




<h3 className="font-bold mb-3">

核心能力

</h3>



<div className="flex flex-wrap gap-3">


{

member.skills.map(skill=>(


<span

key={skill}

className="
border
border-gray-700
rounded-full
px-4
py-2
text-sm
"

>

{skill}

</span>


))

}


</div>



</div>


))


}


</div>


</section>


</main>

)

}