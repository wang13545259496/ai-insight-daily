interface OpportunityMapCardProps {

industry:string;

opportunity:string;

trend:string;

direction:string;

description:string;

}


export default function OpportunityMapCard({

industry,

opportunity,

trend,

direction,

description

}:OpportunityMapCardProps){


return (

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


<h3

className="
text-2xl
font-bold
mb-4
"

>

{industry}

</h3>



<div

className="
text-xl
font-semibold
mb-4
"

>

{opportunity}

</div>




<p

className="
text-gray-400
mb-3
"

>

趋势：{trend}

</p>



<p

className="
text-gray-400
mb-3
"

>

方向：{direction}

</p>



<p

className="
text-gray-500
"

>

{description}

</p>



</div>


)


}