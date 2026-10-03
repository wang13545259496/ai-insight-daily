import Link from "next/link"
import { prisma } from "@/lib/prisma"



export default async function BriefingPage(){


const report =

await prisma.dailyReport.findFirst({

orderBy:{

createdAt:"desc"

}

})



if(!report){

return (

<div className="min-h-screen bg-black text-white p-10">

暂无日报

</div>

)

}




const events =

await prisma.newsEvent.findMany({

include:{

news:true

},

orderBy:{

heatScore:"desc"

},

take:10

})





const opportunities =

await prisma.businessOpportunity.findMany({

take:6,

orderBy:{

createdAt:"desc"

}

})





const categories =

Array.from(

new Set(

events

.map(

item=>item.category

)

.filter(Boolean)

)

)





return (

<div className="
min-h-screen
bg-black
text-white
px-10
py-12
">


<div className="
max-w-7xl
mx-auto
">


<h1 className="
text-4xl
font-bold
">

AI每日事件简报

</h1>


<p className="
text-gray-400
mt-3
">

{report.date}

</p>






<section className="
mt-10
">


<h2 className="
text-3xl
font-bold
mb-6
">

🔥 今日AI十大事件

</h2>



<div className="
grid
md:grid-cols-2
gap-6
">


{

events.map(event=>(


<Link

key={event.id}

href={`/events/${event.id}`}

className="
bg-gray-950
border
border-gray-800
rounded-2xl
p-6
hover:border-gray-500
transition
"

>


<h3 className="
text-xl
font-bold
">

{event.title}

</h3>



<div className="
grid
grid-cols-3
gap-4
mt-5
">


<div>

<p className="
text-gray-500
">

热度

</p>


<p className="
font-bold
text-xl
">

{event.heatScore}

</p>

</div>



<div>

<p className="
text-gray-500
">

峰值

</p>


<p className="
font-bold
text-xl
">

{event.peakScore}

</p>

</div>




<div>

<p className="
text-gray-500
">

新闻

</p>


<p className="
font-bold
text-xl
">

{event.news.length}

</p>

</div>


</div>


</Link>


))

}


</div>


</section>








<section className="
mt-12
grid
md:grid-cols-3
gap-6
">


<Link

href="/trend"

className="
bg-gray-950
border
border-gray-800
rounded-2xl
p-6
hover:border-gray-500
"

>


<h2 className="
text-2xl
font-bold
mb-5
">

📈 热点变化

</h2>



<div className="
space-y-4
">


{

events.slice(0,5)

.map(event=>(


<div

key={event.id}

className="
border-b
border-gray-800
pb-3
"

>


<p className="
font-bold
">

{event.title}

</p>



<p className="
text-gray-400
text-sm
mt-2
">

热度：

{event.heatScore}

&nbsp;

趋势：

{event.trendStatus}

</p>



</div>


))

}


</div>



</Link>







<Link

href="/trend"

className="
bg-gray-950
border
border-gray-800
rounded-2xl
p-6
hover:border-gray-500
"

>


<h2 className="
text-2xl
font-bold
mb-5
">

🚀 新兴趋势

</h2>



<div className="
flex
flex-wrap
gap-3
">


{

categories.map(

item=>(


<span

key={item}

className="
border
border-gray-700
rounded-full
px-4
py-2
"

>

{item}

</span>


)

)


}


</div>



</Link>







<Link

href="/business"

className="
bg-gray-950
border
border-gray-800
rounded-2xl
p-6
hover:border-gray-500
"

>


<h2 className="
text-2xl
font-bold
mb-5
">

💰 商业机会

</h2>



<div className="
space-y-4
">


{

opportunities.map(item=>(


<div

key={item.id}

className="
border-b
border-gray-800
pb-3
"

>


<p className="
font-bold
">

{item.opportunity}

</p>


<p className="
text-gray-400
text-sm
mt-2
">

方向：

{item.direction}

</p>


</div>


))

}


</div>



</Link>





</section>





</div>

</div>

)


}