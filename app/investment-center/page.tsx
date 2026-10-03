import Link from "next/link";
import InvestmentFavorite from "@/components/InvestmentFavorite";

import {
  prisma
} from "@/lib/prisma";



export default async function InvestmentCenterPage(){


const investments =
await prisma.investment.findMany({

orderBy:{

createdAt:"desc"

}

});



return (

<main className="
min-h-screen
bg-black
text-white
p-10
">


<div className="
max-w-6xl
mx-auto
">


<h1 className="
text-4xl
font-bold
">

AI投资数据库中心

</h1>


<p className="
mt-3
text-gray-400
">

AI项目投资价值分析数据库

</p>





<section className="
mt-10
grid
md:grid-cols-3
gap-6
">


{

investments.map(

(item)=>(


<div

key={item.id}

className="
border
border-gray-800
rounded-xl
p-6
bg-gray-950
"


>


<h2 className="
text-2xl
font-bold
">

{item.name}

</h2>



<p className="
mt-2
text-gray-400
">

{item.industry}

</p>




<div className="
mt-5
space-y-2
text-sm
">


<p>

商业模式：

<span className="font-bold">

{item.businessScore}

</span>

</p>



<p>

技术壁垒：

<span className="font-bold">

{item.technologyScore}

</span>

</p>



<p>

市场空间：

<span className="font-bold">

{item.marketScore}

</span>

</p>



<p>

成长能力：

<span className="font-bold">

{item.growthScore}

</span>

</p>


</div>




<Link

href={`/investment/${item.id}`}

className="
inline-block
mt-6
border
border-gray-700
px-5
py-2
rounded
hover:bg-white
hover:text-black
"

>

查看投资报告

</Link>

<div className="
mt-4
">

<InvestmentFavorite

investmentId={item.id}

/>

</div>

</div>


)


)


}



</section>



</div>


</main>

);


}