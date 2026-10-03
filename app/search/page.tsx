import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { searchAI } from "@/lib/search";


export default async function SearchPage({

searchParams,

}:{

searchParams:
Promise<{
q?:string
}>

}){


const params =
await searchParams;



const keyword =
params.q || "";



const results =
keyword
?
searchAI(keyword)
:
[];





const events =
keyword
?
await prisma.newsEvent.findMany({

where:{


OR:[

{
title:{
contains:keyword
}
},

{
keywords:{
contains:keyword
}
},

{
summary:{
contains:keyword
}
}

]


},


orderBy:{

heatScore:"desc"

},


take:5


})
:
[];






return (

<main className="
min-h-screen
bg-black
text-white
px-8
py-12
">


<div className="
max-w-6xl
mx-auto
">



<h1 className="
text-4xl
font-bold
">

AI Intelligence Search

</h1>



<p className="
mt-4
text-gray-400
">

AI新闻、热点事件、模型与产业趋势智能检索

</p>





<form

action="/search"

className="
flex
gap-3
mt-10
"

>



<input

name="q"

defaultValue={keyword}

placeholder="
输入关键词，例如 OpenAI、GPT、Agent
"

className="
flex-1
bg-gray-900
border
border-gray-700
rounded-xl
px-5
py-4
"

/>




<button

className="
bg-white
text-black
px-8
rounded-xl
font-bold
"

>

搜索

</button>


</form>









{

keyword && (

<section className="mt-12">



<h2 className="
text-2xl
font-bold
mb-6
">

搜索：

<span className="text-gray-400">

{keyword}

</span>


</h2>





{/* AI事件结果 */}

{

events.length > 0 && (


<section>


<h3 className="
text-xl
font-bold
mb-5
">

🔥 相关AI热点事件

</h3>



<div className="
space-y-5
">


{

events.map(event=>(


<Link

key={event.id}

href={`/events/${event.id}`}

>



<div

className="
border
border-gray-800
rounded-xl
p-6
hover:border-white
transition
"

>


<h4 className="
text-xl
font-bold
">

{event.title}

</h4>




<div className="
mt-3
text-gray-400
"

>


热度：

<span className="text-white">

{event.heatScore}

</span>



&nbsp;&nbsp;


趋势：

<span className="text-green-400">

{event.trendStatus}

</span>


</div>



</div>


</Link>


))

}



</div>


</section>


)

}





{/* 新闻结果 */}

<section className="mt-12">


<h3 className="
text-xl
font-bold
mb-6
">

📰 新闻结果

</h3>



<div className="space-y-5">


{

results.map(item=>(


<div

key={item.id}

className="
border
border-gray-800
rounded-xl
p-6
"

>


<div className="
text-sm
text-gray-400
">

{item.type}

&nbsp;&nbsp;

影响力：

{item.score}

</div>




<h4 className="
text-xl
font-bold
mt-3
">

{item.title}

</h4>



<p className="
mt-3
text-gray-400
">

{item.description}

</p>



<div className="
mt-3
text-sm
text-gray-500
">

来源：

{item.source}

</div>



</div>


))


}



</div>


</section>




</section>

)

}



</div>


</main>

);


}