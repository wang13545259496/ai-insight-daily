import Link from "next/link";

import { prisma } from "@/lib/prisma";

import {
analyzeEventAlert
} from "@/lib/events/eventAlert";



export default async function EventAlertPage(){



const events =
await prisma.newsEvent.findMany({

orderBy:{
heatScore:"desc"
},


take:50


});





const alerts =
events.map(event=>({


event,


alert:
analyzeEventAlert(event)


}))


.filter(
item =>
item.alert.level!=="normal"
)


.sort(
(a,b)=>
b.alert.priority-
a.alert.priority
);





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
max-w-6xl
mx-auto
"

>



<h1

className="
text-4xl
font-bold
mb-4
"

>

🚨 AI事件预警中心

</h1>



<p className="text-gray-400 mb-10">

自动发现正在升温和爆发的AI事件

</p>






<div className="space-y-5">


{

alerts.map(item=>(



<Link

key={item.event.id}

href={`/events/${item.event.id}`}

>


<div

className="
bg-zinc-950
border
border-zinc-800
rounded-xl
p-6
hover:border-white
"

>



<div className="flex justify-between">


<h2 className="text-xl font-bold">

{item.event.title}

</h2>



<span>

{item.alert.level}

</span>



</div>




<div className="mt-4 text-gray-300">

{item.alert.message}

</div>





<div className="mt-4">


热度：

<span className="font-bold">

{item.event.heatScore}

</span>


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