export default function ResearchCard(

{
title,
category,
summary,
insight,
value
}:{
title:string,
category:string,
summary:string,
insight:string,
value:string
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

{category}

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
研究摘要
</h3>


<p

className="
mt-2
text-gray-400
"

>

{summary}

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
核心洞察
</h3>


<p

className="
mt-2
text-gray-400
"

>

{insight}

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



</div>


)

}