import Link from "next/link";
import { reports } from "@/data/reports";



export default function ReportsPage(){


return (

<main className="min-h-screen bg-black text-white px-8 py-16">


<div className="max-w-6xl mx-auto">



<h1 className="text-5xl font-bold">

AI Research Reports

</h1>



<p className="mt-5 text-xl text-gray-400">

全球人工智能研究报告中心

</p>





<div className="grid md:grid-cols-2 gap-8 mt-14">


{

reports.map((report)=>(


<Link

href={`/reports/${report.id}`}

key={report.id}

className="block"

>


<div

className="
border
border-gray-800
rounded-3xl
p-8
bg-gray-950
hover:border-gray-500
transition
cursor-pointer
"


>



<div className="flex justify-between items-center">


<span

className="
text-sm
px-3
py-1
rounded-full
border
border-gray-700
text-gray-300
"

>

{report.type}

</span>



<span className="text-sm text-gray-400">

{report.date}

</span>


</div>






<h2 className="text-2xl font-bold mt-6">

{report.title}

</h2>





<p className="text-gray-400 mt-5 leading-relaxed">

{report.summary}

</p>







<div className="mt-6">


<p className="text-gray-400 text-sm">

研究员

</p>


<p className="text-gray-200 mt-1">

{report.author}

</p>


</div>







<div className="flex flex-wrap gap-2 mt-6">


{

report.tags.map((tag)=>(


<span

key={tag}

className="
px-3
py-1
rounded-full
bg-gray-900
border
border-gray-800
text-sm
"

>

#{tag}

</span>


))


}


</div>





<div className="mt-8 text-sm text-gray-400">

查看完整研究报告 →

</div>



</div>


</Link>



))


}



</div>



</div>


</main>


)

}