import Link from "next/link";


export default function StartupAgentPage(){


const tools=[

{
title:"创业机会发现",

desc:"发现AI时代创业方向和行业机会",

url:"/startup-discovery"

},


{
title:"MVP方案生成",

desc:"快速生成AI创业最小可行方案",

url:"/mvp-generator"

},


{
title:"创业项目评估",

desc:"分析市场、AI价值和商业潜力",

url:"/startup-evaluation"

},


{
title:"创业研究报告",

desc:"生成完整AI创业分析报告",

url:"/startup-report"

},


{
title:"AI Agent推荐",

desc:"寻找适合业务场景的智能体",

url:"/agent-recommend"

}

];



return (

<main className="min-h-screen bg-black text-white p-10">


<section className="max-w-6xl mx-auto">


<h1 className="text-5xl font-bold mb-5">

AI Startup Agent

</h1>


<p className="text-gray-400 text-xl mb-12">

你的AI创业研究与决策助手

</p>




<div className="
grid
md:grid-cols-2
lg:grid-cols-3
gap-8
">


{

tools.map(tool=>(


<Link

href={tool.url}

key={tool.title}

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


<h2 className="text-2xl font-bold mb-4">

{tool.title}

</h2>


<p className="text-gray-400">

{tool.desc}

</p>


</Link>


))


}


</div>


</section>


</main>

)

}