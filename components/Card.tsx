export default function Card(

{
title,
children
}:{
title:string,
children:React.ReactNode
}

){


return (

<div

className="
bg-zinc-950
border
border-zinc-800
rounded-2xl
p-6
hover:border-zinc-500
transition
"

>


<h3

className="
text-xl
font-bold
mb-5
"

>

{title}

</h3>



<div

className="
text-gray-400
space-y-3
"

>

{children}

</div>


</div>


)

}