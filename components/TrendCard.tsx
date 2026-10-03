export default function TrendCard({

  name,

  heat,

  growth,

  description


}:{

  name:string;

  heat:number;

  growth:string;

  description:string;


}){


return (

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
grid
grid-cols-2
gap-4
mb-5
"

>


<div>

<div className="text-gray-500">

热度

</div>


<div

className="
text-3xl
font-bold
"

>

{heat}

</div>


</div>



<div>

<div className="text-gray-500">

增长

</div>


<div

className="
text-3xl
font-bold
text-green-400
"

>

{growth}

</div>


</div>



</div>




<p

className="
text-gray-400
leading-7
"

>

{description}

</p>


</div>

)

}