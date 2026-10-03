import Link from "next/link";


export default function EcosystemCard(

{
title,
desc,
href
}:{
title:string,
desc:string,
href:string
}

){


return (

<Link

href={href}

className="
block
bg-zinc-950
border
border-zinc-800
rounded-2xl
p-6
hover:border-white
transition
"

>


<h3

className="
text-xl
font-bold
"

>

{title}

</h3>



<p

className="
mt-3
text-gray-400
"

>

{desc}

</p>



<div

className="
mt-5
text-sm
"

>

进入 →

</div>



</Link>


)

}