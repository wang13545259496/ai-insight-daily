import Link from "next/link";


export default function StartupLab(){


return (

<section
className="
mt-16
border
border-gray-800
rounded-3xl
p-10
bg-gradient-to-br
from-gray-950
to-black
"
>


<div className="max-w-3xl">


<p className="
text-gray-500
uppercase
tracking-widest
text-sm
">

AI STARTUP LAB

</p>



<h2 className="
text-4xl
font-bold
mt-4
">

AI创业智能实验室

</h2>



<p className="
text-gray-400
mt-5
text-lg
leading-8
">

从AI趋势发现，到创业项目设计，
帮助探索下一代AI商业机会。

</p>



<div className="
grid
md:grid-cols-3
gap-5
mt-8
">


<div className="
border
border-gray-800
rounded-xl
p-5
">

<h3 className="font-bold">

01 机会发现

</h3>

<p className="text-gray-500 mt-2">

AI市场趋势分析

</p>

</div>



<div className="
border
border-gray-800
rounded-xl
p-5
">

<h3 className="font-bold">

02 产品设计

</h3>

<p className="text-gray-500 mt-2">

生成AI创业方案

</p>

</div>



<div className="
border
border-gray-800
rounded-xl
p-5
">

<h3 className="font-bold">

03 MVP验证

</h3>

<p className="text-gray-500 mt-2">

快速验证市场

</p>

</div>



</div>



<Link

href="/startup-generator"

className="
inline-block
mt-10
px-8
py-4
border
border-white
rounded-xl
hover:bg-white
hover:text-black
transition
"

>

进入创业实验室 →

</Link>



</div>


</section>


)

}