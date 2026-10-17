export default function AgentCard(

{
name,
category,
score,
description,
usage
}:{
name:string,
category:string,
score:number,
description:string,
usage:string
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

{name}

</h2>



<div

className="
text-green-400
text-2xl
font-bold
"

>

{score}

</div>


</div>





<div

className="
mt-4
text-sm
text-gray-400
"

>

分类：

{category}

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
功能介绍
</h3>


<p

className="
mt-2
text-gray-400
"

>

{description}

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
应用场景
</h3>


<p

className="
mt-2
text-gray-400
"

>

{usage}

</p>


</div>



</div>

)

}