import Link from "next/link";
import { prisma } from "@/lib/prisma";

const MODEL_MATRIX = [
  {
    name: "OpenAI GPT",
    description: "通用大模型与企业AI应用生态",
    keywords: ["GPT", "OpenAI", "ChatGPT"],
  },
  {
    name: "Anthropic Claude",
    description: "安全型大模型与企业知识应用",
    keywords: ["Claude", "Anthropic"],
  },
  {
    name: "Google Gemini",
    description: "多模态模型与Google AI生态",
    keywords: ["Gemini", "DeepMind"],
  },
  {
    name: "DeepSeek",
    description: "国产开源模型与推理能力方向",
    keywords: ["DeepSeek"],
  },
  {
    name: "大模型基础设施",
    description: "训练、推理、开源模型生态",
    keywords: ["LLM", "开源", "训练", "推理"],
  },
];

export default async function ModelsPage() {

  const [
    newsCount,
    eventCount,
    modelNews,
    modelEvents,
  ] = await Promise.all([

    prisma.news.count({
      where:{
        dataStatus:"active"
      }
    }),

    prisma.newsEvent.count({
      where:{
        status:"active"
      }
    }),

    prisma.news.findMany({
      where:{
        OR:[
          {title:{contains:"模型"}},
          {title:{contains:"GPT"}},
          {title:{contains:"Claude"}},
          {title:{contains:"Gemini"}},
          {title:{contains:"大模型"}},
          {title:{contains:"Astra"}},
          {title:{contains:"LLM"}},
          {title:{contains:"多模态"}},
          {title:{contains:"推理"}},
          {title:{contains:"开源"}},
          {title:{contains:"训练"}},
          {summary:{contains:"模型"}},
          {summary:{contains:"GPT"}},
          {summary:{contains:"大模型"}},
        ],
        dataStatus:"active"
      },
      orderBy:{
        createdAt:"desc"
      },
      take:8,
      select:{
        id:true,
        title:true,
        summary:true,
        createdAt:true
      }
    }),

    prisma.newsEvent.findMany({
      where:{
        status:"active",
        OR:[
          {title:{contains:"模型"}},
          {title:{contains:"GPT"}},
          {title:{contains:"Claude"}},
          {title:{contains:"Gemini"}},
          {title:{contains:"大模型"}},
        ]
      },
      orderBy:{
        heatScore:"desc"
      },
      take:8,
      select:{
        id:true,
        title:true,
        heatScore:true
      }
    })

  ]);


  const modelMatrix = MODEL_MATRIX.map((model) => {
    const news = modelNews.filter((item) =>
      model.keywords.some((keyword) =>
        (
          item.title +
          " " +
          (item.summary || "")
        )
        .toLowerCase()
        .includes(keyword.toLowerCase())
      )
    );

    const events = modelEvents.filter((item) =>
      model.keywords.some((keyword) =>
        item.title
          .toLowerCase()
          .includes(keyword.toLowerCase())
      )
    );

    return {
      ...model,
      newsCount: news.length,
      eventCount: events.length,
    };
  });


  return (

<div className="min-h-screen bg-black text-white p-8">

<div className="max-w-7xl mx-auto">


<section className="border border-gray-800 rounded-3xl bg-gray-950 p-8">

<h1 className="text-4xl font-bold">
AI模型生态中心
</h1>

<p className="mt-4 text-gray-400">
基础模型观察 · 企业应用生态 · AI技术趋势分析
</p>


<div className="mt-8 grid md:grid-cols-3 gap-5">

<MetricCard
title="AI资讯节点"
value={String(newsCount)}
/>

<MetricCard
title="事件分析节点"
value={String(eventCount)}
/>

<MetricCard
title="模型生态"
value="持续演进"
/>

</div>

</section>






<section className="mt-8">

<h2 className="text-2xl font-bold">
模型生态矩阵
</h2>

<p className="mt-3 text-gray-400">
基础模型、企业应用与技术生态观察入口
</p>


<div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-5">

{modelMatrix.map((model)=>(

<Link
key={model.name}
href={`/search?q=${encodeURIComponent(model.keywords[0])}`}
className="border border-gray-800 rounded-3xl bg-gray-950 p-6 hover:border-gray-500"
>

<div className="text-xl font-bold">
{model.name}
</div>

<p className="mt-3 text-gray-400 text-sm">
{model.description}
</p>


<div className="mt-5 flex gap-6 text-sm">

<div>
<div className="text-gray-500">
资讯
</div>
<div className="mt-1 font-bold">
{model.newsCount}
</div>
</div>


<div>
<div className="text-gray-500">
事件
</div>
<div className="mt-1 font-bold">
{model.eventCount}
</div>
</div>

</div>

<div className="mt-5 text-gray-400 text-sm">
查看相关内容 →
</div>


</Link>

))}

</div>

</section>


<section className="mt-6 grid md:grid-cols-2 gap-6">


<div className="border border-gray-800 rounded-3xl bg-gray-950 p-6">

<h2 className="text-2xl font-bold">
🤖 模型最新资讯
</h2>

<div className="mt-5 space-y-4">

{modelNews.map(item=>(
<Link
key={item.id}
href={`/news/${item.id}`}
className="block border-b border-gray-800 pb-3 hover:text-gray-300"
>

<div className="font-medium">
{item.title}
</div>

<div className="mt-2 text-xs text-gray-500">
{new Date(item.createdAt).toLocaleDateString("zh-CN")}
</div>

</Link>
))}

</div>


<Link
href="/search?q=GPT"
className="block mt-6 text-gray-400 hover:text-white"
>
搜索全部模型资讯 →
</Link>


</div>



<div className="border border-gray-800 rounded-3xl bg-gray-950 p-6">


<h2 className="text-2xl font-bold">
🔥 模型生态事件
</h2>


<div className="mt-5 space-y-4">

{modelEvents.map(item=>(

<Link
key={item.id}
href={`/events/${item.id}`}
className="block border-b border-gray-800 pb-3 hover:text-gray-300"
>

<div className="flex items-center justify-between gap-3">

<span className="font-medium">
{item.title}
</span>

<span className="text-xs text-gray-500">
热度 {Math.round(item.heatScore)}
</span>

</div>

</Link>

))}

</div>


<Link
href="/search?q=模型"
className="block mt-6 text-gray-400 hover:text-white"
>
搜索全部模型事件 →
</Link>


</div>


</section>




<section className="mt-6 grid md:grid-cols-3 gap-5">


<Link
href="/agent"
className="border border-gray-800 rounded-3xl bg-gray-950 p-6 hover:border-gray-500"
>

🤖 Agent生态

<p className="mt-3 text-gray-400">
模型能力向智能体应用延伸
</p>

</Link>



<Link
href="/investment"
className="border border-gray-800 rounded-3xl bg-gray-950 p-6 hover:border-gray-500"
>

📈 投资观察

<p className="mt-3 text-gray-400">
模型公司与产业机会分析
</p>

</Link>



<Link
href="/opportunity-map"
className="border border-gray-800 rounded-3xl bg-gray-950 p-6 hover:border-gray-500"
>

💰 商业机会

<p className="mt-3 text-gray-400">
模型商业化应用方向
</p>

</Link>


</section>


</div>

</div>

  );
}



function MetricCard({
title,
value,
}:{
title:string;
value:string;
}){

return(

<div className="border border-gray-800 rounded-2xl p-5">

<div className="text-gray-400">
{title}
</div>

<div className="mt-3 text-3xl font-bold">
{value}
</div>

</div>

)

}
