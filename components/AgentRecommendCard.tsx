import Link from "next/link";


interface AgentRecommendCardProps {


id:number;


title:string;


agentName:string;


reason:string;


tag:string;


}



export default function AgentRecommendCard({


id,

title,

agentName,

reason,

tag


}:AgentRecommendCardProps){



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
"


>



<div

className="
text-sm
text-gray-400
mb-3
"

>

{tag}

</div>






<h3

className="
text-2xl
font-bold
mb-4
"

>

{title}

</h3>







<p

className="
text-white
mb-4
"

>

推荐：

{agentName}

</p>







<p

className="
text-gray-400
leading-relaxed
"

>

{reason}

</p>






<p

className="
mt-6
text-sm
text-gray-400
"

>

查看详情 →

</p>





</div>


</Link>


)


}