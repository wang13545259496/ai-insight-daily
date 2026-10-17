export default function NewsCard(

{
title,
time,
background,
content,
source,
tag
}:{
title:string,
time:string,
background:string,
content:string,
source:string,
tag:string
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
gap-4
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
px-3
py-1
bg-zinc-800
rounded-full
text-sm
whitespace-nowrap
"
>

{tag}

</span>


</div>





<p
className="
mt-4
text-sm
text-gray-400
"
>

时间：
{time}

</p>





<div
className="
mt-6
grid
md:grid-cols-3
gap-6
"
>


<div>

<h3
className="
font-bold
"
>
背景
</h3>


<p
className="
mt-2
text-gray-400
"
>
{background}
</p>


</div>





<div>

<h3
className="
font-bold
"
>
内容
</h3>


<p
className="
mt-2
text-gray-400
"
>
{content}
</p>


</div>





<div>

<h3
className="
font-bold
"
>
来源
</h3>


<p
className="
mt-2
text-gray-400
"
>
{source}
</p>


</div>


</div>


</div>

)

}