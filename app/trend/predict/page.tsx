

import SectionTitle from "@/components/SectionTitle";
import PredictionCard from "@/components/PredictionCard";

import { predictions } from "@/data/prediction";



export default function PredictionPage(){


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

title="AI预测引擎"

desc="基于技术趋势分析未来AI发展方向"

/>





<div

className="
grid
md:grid-cols-2
gap-6
"

>


{

predictions.map(item=>(


<PredictionCard

key={item.id}

title={item.title}

probability={item.probability}

trend={item.trend}

description={item.description}

/>


))


}


</div>



</section>










</div>


)

}