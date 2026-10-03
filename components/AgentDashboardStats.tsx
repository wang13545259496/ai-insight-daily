interface AgentDashboardStatsProps {


totalAgents:number;


industryCount:number;


opportunityCount:number;


hotDirection:string;


}




export default function AgentDashboardStats({

totalAgents,

industryCount,

opportunityCount,

hotDirection

}:AgentDashboardStatsProps){



const stats=[


{

title:"Agent总量",

value:`${totalAgents}+`

},


{

title:"行业方向",

value:`${industryCount}类`

},


{

title:"商业机会",

value:`${opportunityCount}个`

},


{

title:"热门方向",

value:hotDirection

}



];





return (


<div

className="
grid
md:grid-cols-4
gap-6
"

>


{


stats.map(item=>(


<div


key={item.title}


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


<h3

className="
text-gray-400
mb-3
"

>

{item.title}

</h3>



<p

className="
text-3xl
font-bold
"

>

{item.value}

</p>



</div>


))


}



</div>


)


}