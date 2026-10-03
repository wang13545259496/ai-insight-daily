"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";



export default function Header(){


const pathname = usePathname();



const navItems=[


{
title:"首页",
href:"/"
},


{
title:"AI资讯",
href:"/news"
},


{
title:"AI模型",
href:"/models"
},


{
title:"AI Agent",
href:"/agent"
},


{
title:"AI研究",
href:"/research-team"
},


{
title:"AI创业",
href:"/startup-agent"
},


{
title:"商业智能",
href:"/business-center"
}


];




return (

<header

className="
border-b
border-zinc-800
bg-black
"

>


<div

className="
max-w-7xl
mx-auto
px-6
"

>


<div

className="
flex
justify-between
items-center
pt-6
"

>


<Link

href="/"

className="
text-3xl
font-bold
"

>

AI Insight Daily

</Link>




<p

className="
text-gray-500
hidden
md:block
"

>

AI Intelligence Platform

</p>



</div>







<nav

className="
mt-8
flex
gap-8
pb-6
flex-wrap
"

>


{

navItems.map(item=>(


<Link

key={item.href}

href={item.href}

className={

`

text-sm

transition

${

pathname===item.href

?

"text-white font-bold"

:

"text-gray-400 hover:text-white"

}

`

}


>

{item.title}


</Link>


))


}



</nav>




</div>


</header>


)

}