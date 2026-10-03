import Link from "next/link";


interface AgentMarketCardProps {


id:number;

name:string;

category:string;

type:string;

scene:string;

heat:string;

description:string;


}



export default function AgentMarketCard({


id,

name,

category,

type,

scene,

heat,

description


}:AgentMarketCardProps){



return (


<Link


href={`/agent-market/${id}`}


className="
block
"


>


<div


className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
hover:border-gray-500
transition
cursor-pointer
"


>



<h3

className="
text-2xl
font-bold
mb-4
"

>

{name}

</h3>




<div

className="
space-y-2
text-gray-400
"

>


<p>

分类：
{category}

</p>



<p>

类型：
{type}

</p>



<p>

应用场景：
{scene}

</p>



<p>

热度：
{heat}

</p>


</div>






<p

className="
mt-5
text-gray-500
leading-relaxed
"

>

{description}

</p>





<p

className="
mt-6
text-sm
text-gray-400
"

>

查看Agent详情 →

</p>




</div>


</Link>


)


}