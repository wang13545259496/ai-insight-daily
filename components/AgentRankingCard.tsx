import Link from "next/link";


interface AgentRankingCardProps {


rank:number;


name:string;


score:number;


trend:string;


hot:number;


category:string;


desc:string;


id?:number;


}




export default function AgentRankingCard({


rank,

name,

score,

trend,

hot,

category,

desc,

id


}:AgentRankingCardProps){



const content=(


<div

className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
hover:border-white
transition
"

>



<div

className="
flex
justify-between
items-center
mb-5
"

>


<h3

className="
text-3xl
font-bold
"

>

{

rank===1

?

"🥇"

:

rank===2

?

"🥈"

:

rank===3

?

"🥉"

:

`#${rank}`

}

</h3>



<div

className="
text-gray-400
"

>

热度：

{hot}

</div>



</div>







<h2

className="
text-2xl
font-bold
mb-3
"

>

{name}

</h2>






<p className="text-gray-400">

分类：

{category}

</p>





<p className="text-gray-400 mt-2">

能力评分：

{score}

</p>






<p className="text-gray-400 mt-2">

趋势：

{trend}

</p>







<p

className="
mt-5
text-gray-400
leading-relaxed
"

>

{desc}

</p>






<div

className="
mt-6
text-sm
text-gray-400
"

>

查看详情 →

</div>





</div>


);






if(id){


return (

<Link

href={`/agent-market/${id}`}

>

{content}

</Link>

)


}



return content;



}