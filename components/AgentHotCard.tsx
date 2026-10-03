interface AgentHotCardProps {


name:string;

hot:number;

level:string;

color:string;

desc:string;


}



export default function AgentHotCard({

name,

hot,

level,

color,

desc


}:AgentHotCardProps){



return (


<div

className="
border
border-gray-800
rounded-2xl
p-8
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
"

>


<h2

className="
text-2xl
font-bold
"

>

{name}

</h2>




<span

className={`
border
border-gray-700
rounded-full
px-4
py-1
text-sm
${color}
`}

>

{level}

</span>



</div>









<div

className="
mt-8
text-center
"

>


<div

className="
text-6xl
font-bold
"

>

{hot}

</div>




<p

className="
mt-3
text-gray-400
"

>

Agent热度指数

</p>



</div>









<div

className="
mt-8
"

>


<div

className="
h-3
bg-gray-800
rounded-full
overflow-hidden
"

>


<div

className="
h-full
bg-white
"

style={{

width:`${hot}%`

}}

/>


</div>


</div>









<p

className="
mt-8
text-gray-400
"

>

{desc}

</p>





</div>


)


}