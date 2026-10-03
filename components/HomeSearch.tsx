import Link from "next/link";


export default function HomeSearch(){


return (


<section


className="
mt-10
max-w-3xl
"

>


<div

className="
flex
bg-neutral-950
border
border-gray-800
rounded-2xl
overflow-hidden
"

>


<input


placeholder="搜索 AI客服、AI编程、企业自动化..."


className="
flex-1
bg-transparent
p-5
outline-none
text-white
"


/>




<Link


href="/ai-search"


className="
px-8
flex
items-center
border-l
border-gray-800
hover:bg-white
hover:text-black
transition
"

>


智能搜索


</Link>




</div>



</section>


)


}