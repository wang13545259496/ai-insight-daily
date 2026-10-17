export default function ReportCard(

{
title,
date,
summary,
highlights,
analysis
}:{
title:string,
date:string,
summary:string,
highlights:string[],
analysis:string
}

){


return (

<div

className="
bg-zinc-950
border
border-zinc-800
rounded-xl
p-8
"

>


<div
className="
flex
justify-between
items-start
gap-5
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
text-sm
text-gray-400
"
>

{date}

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
今日摘要
</h3>


<p
className="
mt-3
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
重点事件
</h3>


<div
className="
mt-3
space-y-2
text-gray-400
"
>

{

highlights.map(item=>(

<div
key={item}
>
• {item}
</div>

))

}

</div>


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
AI分析
</h3>


<p
className="
mt-3
text-gray-400
"
>

{analysis}

</p>


</div>





</div>


)

}