import Link from "next/link";



import SectionTitle from "@/components/SectionTitle";
import TrendCard from "@/components/TrendCard";

import { trends } from "@/data/trend";



export default function TrendPage(){


return (

<div

className="
min-h-screen
bg-black
text-white
p-8
"

>








<section

className="
mt-12
"

>


<SectionTitle

title="AI趋势分析中心"

desc="分析人工智能技术发展方向、市场热度和未来机会"

/>





<div

className="
flex
justify-end
mb-8
"

>


<Link

href="/trend/predict"

className="
border
border-zinc-700
px-5
py-3
rounded-lg
hover:border-white
"

>

进入AI预测引擎 →

</Link>


</div>







<div

className="
grid
md:grid-cols-2
gap-6
"

>


{

trends.map(item=>(


<TrendCard

key={item.id}

name={item.name}

heat={item.heat}

growth={item.growth}

description={item.description}

/>


))


}


</div>



</section>










</div>


)

}