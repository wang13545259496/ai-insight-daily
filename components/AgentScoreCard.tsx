interface AgentScoreCardProps {


name:string;

ability:number;

technology:number;

business:number;

ecosystem:number;

total:number;

level:string;

desc:string;


}



export default function AgentScoreCard({

name,

ability,

technology,

business,

ecosystem,

total,

level,

desc

}:AgentScoreCardProps){



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

className="
border
border-gray-700
rounded-full
px-4
py-1
text-sm
"

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

{total}

</div>



<p

className="
text-gray-400
mt-2
"

>

综合评分

</p>



</div>









<div

className="
mt-8
space-y-5
"

>



<ScoreItem

title="智能能力"

value={ability}

/>



<ScoreItem

title="技术能力"

value={technology}

/>



<ScoreItem

title="商业价值"

value={business}

/>



<ScoreItem

title="生态能力"

value={ecosystem}

/>



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







function ScoreItem({

title,

value

}:{

title:string;

value:number;

}){


return (

<div>


<div

className="
flex
justify-between
mb-2
"

>


<span>

{title}

</span>



<span>

{value}

</span>



</div>





<div

className="
h-2
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

width:`${value}%`

}}

/>



</div>


</div>


)


}