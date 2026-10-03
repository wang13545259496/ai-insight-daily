export default function PredictionCard(

{
title,
probability,
trend,
description
}:{
title:string,
probability:string,
trend:string,
description:string
}

){


return (

<div

className="
bg-zinc-950
border
border-zinc-800
rounded-xl
p-7
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

{title}

</h2>


<div

className="
text-green-400
text-xl
font-bold
"

>

{probability}

</div>


</div>





<div

className="
mt-5
text-gray-400
"

>

趋势：

{trend}

</div>





<p

className="
mt-5
text-gray-400
leading-relaxed
"

>

{description}

</p>



</div>

)

}