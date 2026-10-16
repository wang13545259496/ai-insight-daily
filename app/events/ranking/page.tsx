import Link from "next/link";
import NewsTitle from "@/components/NewsTitle";

import { prisma } from "@/lib/prisma";

import {
sortEventsByHot
} from "@/lib/events/eventRanking";



export default async function EventRankingPage(){



const events =
await prisma.newsEvent.findMany({

take:50,

orderBy:{
heatScore:"desc"
}

});




const ranking =
sortEventsByHot(events);





return (

<main

className="
min-h-screen
bg-black
text-white
p-8
"

>


<div

className="
max-w-5xl
mx-auto
"

>



<h1

className="
text-4xl
font-bold
mb-3
"

>

🔥 AI热点事件排行榜

</h1>



<p className="text-gray-400 mb-10">

实时计算AI行业事件热度

</p>





<div className="space-y-5">


{

ranking.slice(0,10)
.map(
(event,index)=>(


<Link

key={event.id}

href={`/events/${event.id}`}

>


<div

className="
bg-zinc-950
border
border-zinc-800
rounded-xl
p-6
flex
justify-between
hover:border-white
"

>


<div>


<div className="text-gray-500">

TOP {index+1}

</div>



<h2 className="text-xl font-bold mt-2">

<NewsTitle title={event.title} titleZh={event.titleZh} />

</h2>


</div>




<div className="text-right">


<div className="text-gray-400">

热度

</div>


<div className="text-3xl font-bold">

{event.heatScore}

</div>


</div>




</div>


</Link>


))


}



</div>




</div>


</main>


)

}