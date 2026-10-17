export default function DashboardStats(){


const stats=[

{
title:"AI综合指数",
value:"92"
},

{
title:"今日热点",
value:"128"
},

{
title:"Agent数量",
value:"356"
},

{
title:"创业机会",
value:"48"
}

];


return (

<div

className="
grid
grid-cols-2
md:grid-cols-4
gap-5
"

>


{

stats.map(item=>(


<div

key={item.title}

className="
bg-zinc-950
border
border-zinc-800
rounded-2xl
p-6
"

>


<p

className="
text-gray-400
"

>

{item.title}

</p>



<div

className="
mt-3
text-4xl
font-bold
"

>

{item.value}

</div>



</div>


))


}


</div>


)

}