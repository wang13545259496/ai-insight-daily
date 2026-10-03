interface CategoryItem {


name:string;


value:number;


}




interface AgentCategoryChartProps {


categories:CategoryItem[];


}





export default function AgentCategoryChart({

categories

}:AgentCategoryChartProps){



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

AI Agent行业分布

</h2>






<div

className="
space-y-6
"

>


{


categories.map(item=>(


<div

key={item.name}

>


<div

className="
flex
justify-between
mb-2
"

>


<span>

{item.name}

</span>



<span

className="
text-gray-400
"

>

{item.value}

</span>



</div>






<div

className="
w-full
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