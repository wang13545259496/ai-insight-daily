import Link from "next/link"
import { prisma } from "@/lib/prisma"



export default async function EventsPage(){


const events =

await prisma.newsEvent.findMany({

include:{

news:true

},

orderBy:{


heatScore:"desc"


}

})




return (

<div className="
min-h-screen
bg-black
text-white
px-10
py-12
">


<div className="
max-w-6xl
mx-auto
">


<h1 className="
text-4xl
font-bold
mb-3
">

AI热点事件中心

</h1>



<p className="
text-gray-400
mb-10
">

实时追踪AI领域重要事件变化

</p>




<div className="
grid
md:grid-cols-2
gap-6
">


{

events.map((event)=>(


<Link

key={event.id}

href={`/events/${event.id}`}

className="
border
border-gray-800
rounded-2xl
p-6
bg-gray-950
hover:border-gray-500
transition
"

>


<div className="
flex
justify-between
items-start
">


<h2 className="
text-2xl
font-bold
leading-tight
">

{event.title}

</h2>



<span className="
text-sm
text-gray-400
">

#{event.id}

</span>


</div>





<p className="
text-gray-400
mt-4
leading-7
line-clamp-3
">

{event.summary}

</p>






<div className="
grid
grid-cols-3
gap-4
mt-6
">


<div>

<p className="
text-gray-500
text-sm
">

热度

</p>


<p className="
text-xl
font-bold
">

{event.heatScore}

</p>


</div>




<div>

<p className="
text-gray-500
text-sm
">

峰值

</p>


<p className="
text-xl
font-bold
">

{event.peakScore}

</p>


</div>




<div>

<p className="
text-gray-500
text-sm
">

新闻

</p>


<p className="
text-xl
font-bold
">

{event.news.length}

</p>


</div>


</div>






<div className="
mt-6
flex
items-center
justify-between
">


<span className="
px-3
py-1
rounded-full
border
border-gray-700
text-sm
">

{event.trendStatus}

</span>



<span className="
text-gray-500
text-sm
">

{event.category}

</span>


</div>



</Link>


))


}


</div>



</div>


</div>

)


}