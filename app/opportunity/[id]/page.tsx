interface PageProps {

params: Promise<{
id:string
}>

}



const opportunities=[


{
id:"1",
title:"AI企业智能助手",
industry:"企业服务",
trend:"高速增长",
description:
"利用AI Agent帮助企业完成办公自动化、知识管理和流程优化。",
market:
"企业数字化升级推动AI助手需求增长。",
chance:
"开发企业知识库助手、办公自动化Agent和流程智能化工具。"
},


{
id:"2",
title:"AI智能客服",
industry:"客户服务",
trend:"持续增长",
description:
"利用大语言模型实现智能问答、客户服务和业务咨询。",
market:
"企业希望降低客服成本，提高服务效率。",
chance:
"打造面向电商、物业、教育等行业的AI客服系统。"
},


{
id:"3",
title:"AI内容生产",
industry:"内容产业",
trend:"快速发展",
description:
"利用生成式AI生产文字、图片、视频和营销内容。",
market:
"企业和个人对AI内容工具需求不断增加。",
chance:
"开发AI内容自动化生产平台。"
},


{
id:"4",
title:"AI教育助手",
industry:"教育行业",
trend:"潜力方向",
description:
"利用AI提供学习辅助和个性化教育服务。",
market:
"教育行业正在探索AI辅助教学。",
chance:
"开发AI学习助手和培训系统。"
}


];



export default async function OpportunityDetail({
params
}:PageProps){



const {id}=await params;



const opportunity =
opportunities.find(
item=>item.id===id
);



if(!opportunity){


return (

<main className="
min-h-screen
bg-black
text-white
p-12
">


<h1 className="
text-3xl
font-bold
">

机会不存在

</h1>


<p className="text-gray-400 mt-4">

当前ID：
{id}

</p>


</main>

)


}



return (

<main className="
min-h-screen
bg-black
text-white
px-8
py-12
">


<div className="
max-w-5xl
mx-auto
">


<h1 className="
text-4xl
font-bold
mb-8
">

{opportunity.title}

</h1>



<div className="
border
border-gray-800
rounded-2xl
p-8
bg-neutral-950
space-y-8
">


<div>

<h2 className="text-xl font-bold">

行业

</h2>

<p className="text-gray-300">

{opportunity.industry}

</p>

</div>



<div>

<h2 className="text-xl font-bold">

发展趋势

</h2>

<p className="text-gray-300">

{opportunity.trend}

</p>

</div>



<div>

<h2 className="text-xl font-bold">

机会描述

</h2>

<p className="text-gray-300">

{opportunity.description}

</p>

</div>



<div>

<h2 className="text-xl font-bold">

市场背景

</h2>

<p className="text-gray-300">

{opportunity.market}

</p>

</div>



<div>

<h2 className="text-xl font-bold">

创业方向

</h2>

<p className="text-gray-300">

{opportunity.chance}

</p>

</div>



</div>


</div>


</main>

)

}