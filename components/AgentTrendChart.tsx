interface TrendItem {


year:string;


value:number;


}



interface AgentTrendChartProps {


trend:TrendItem[];


}





export default function AgentTrendChart({

trend

}:AgentTrendChartProps){



return (


<div


className="
border
border-gray-800
rounded-2xl
p-8
bg-neutral-950
"


>


<h2

className="
text-3xl
font-bold
mb-8
"

>

AI Agent发展趋势

</h2>







<div

className="
space-y-6
"

>


{


trend.map(item=>(


<div

key={item.year}

>


<div

className="
flex
justify-between
mb-2
"

>


<span>

{item.year}

</span>



<span

className="
text-gray-400
"

>

{item.value}

%

</span>



</div>







<div

className="
h-4
bg-gray-800
rounded-full
overflow-hidden
"

>


<div


className="
h-full
bg-white
rounded-full
"

style={{

width:`${item.value}%`

}}


/>



</div>





</div>


))


}



</div>





</div>


)


}