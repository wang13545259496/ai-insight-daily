export default function StartupCard(

{
title,
field,
market,
opportunity,
mvp
}:{
title:string,
field:string,
market:string,
opportunity:string,
mvp:string
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

{field}

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
市场空间
</h3>


<p

className="
mt-2
text-gray-400
"

>

{market}

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
创业机会
</h3>


<p

className="
mt-2
text-gray-400
"

>

{opportunity}

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
MVP建议
</h3>


<p

className="
mt-2
text-green-400
"

>

{mvp}

</p>


</div>




</div>


)

}