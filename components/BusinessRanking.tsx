import Link from "next/link";

import {

getRank

}

from "@/data/businessDashboard";





export default function BusinessRanking(){


const list=getRank();



return (


<section className="mt-12">


<h2 className="text-3xl font-bold mb-8">

🏆 AI商业机会排行榜

</h2>





<div className="space-y-5">



{

list.map((item,index)=>(


<div

key={item.id}

className="bg-gray-900 rounded-xl p-6 flex justify-between items-center"

>


<div>


<h3 className="text-xl font-bold">

#{index+1} {item.name}

</h3>



<p className="text-gray-400 mt-2">

{item.industry}

 · 

{item.market}

</p>


</div>






<div className="text-right">


<p className="text-gray-400">

AI商业指数

</p>



<p className="text-3xl font-bold">

{item.score}

</p>



<Link

href={`/business/${item.id}`}

className="text-blue-400"

>

查看分析

</Link>


</div>



</div>


))


}



</div>


</section>


)


}