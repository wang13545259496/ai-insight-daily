export default function BusinessCard(

{
title,
industry,
solution,
value,
path
}:{
title:string,
industry:string,
solution:string,
value:string,
path:string
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
items-start
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



<span

className="
bg-zinc-800
px-3
py-1
rounded-full
text-sm
"

>

{industry}

</span>


</div>





<div

className="
mt-6
"

>


<h3
className="
font-bold
"
>
AI解决方案
</h3>


<p

className="
mt-2
text-gray-400
"

>

{solution}

</p>


</div>






<div

className="
mt-6
"

>


<h3
className="
font-bold
"
>
商业价值
</h3>


<p

className="
mt-2
text-green-400
"

>

{value}

</p>


</div>






<div

className="
mt-6
"

>


<h3
className="
font-bold
"
>
落地路径
</h3>


<p

className="
mt-2
text-gray-400
"

>

{path}

</p>


</div>



</div>


)

}