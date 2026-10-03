import InvestmentExport
from "@/components/InvestmentExport";

import InvestmentPDF from "@/components/InvestmentPDF";


import {
generateMarkdownReport
}
from "@/lib/investment/export";

import {
  investmentCompanies
} from "@/data/investment";


import {
  calculateInvestmentScore
} from "@/lib/investment/score";


import {
  generateInvestmentReport
} from "@/lib/investment/report";



export default async function InvestmentDetailPage({

params,

}:{

params:Promise<{

id:string;

}>;

}){



const {id}=await params;



const company = investmentCompanies.find(

(item)=>item.id===Number(id)

);



if(!company){


return (

<main className="
min-h-screen
bg-black
text-white
p-10
">


<h1 className="
text-3xl
font-bold
">

投资项目不存在

</h1>


<p className="
mt-4
text-gray-400
">

ID:
{id}

</p>


</main>

);


}





const score =
calculateInvestmentScore({


businessScore:
company.businessScore,


technologyScore:
company.technologyScore,


marketScore:
company.marketScore,


growthScore:
company.growthScore,


riskScore:
100-company.riskScore


});





const report =
generateInvestmentReport(company);


const markdown =
generateMarkdownReport(

company.name,

report

);




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

{company.name}

</h1>



<p className="
mt-3
text-gray-400
text-lg
">

{company.industry}

</p>






{/* AI投资评级 */}


<section className="
mt-10
border
border-gray-800
rounded-xl
bg-gray-950
p-8
">


<h2 className="
text-2xl
font-bold
">

AI投资价值评级

</h2>



<div className="
mt-6
flex
gap-12
items-center
">


<div>

<p className="
text-gray-400
">

综合评分

</p>


<p className="
text-6xl
font-bold
">

{score.total}

</p>


</div>




<div>

<p className="
text-4xl
font-bold
">

{score.level}

</p>


<p className="
mt-3
text-gray-400
">

{score.description}

</p>


</div>



</div>


</section>








{/* 五维评分 */}


<section className="
mt-10
grid
md:grid-cols-5
gap-5
">


{

[

["商业模式",company.businessScore],

["技术壁垒",company.technologyScore],

["市场空间",company.marketScore],

["成长能力",company.growthScore],

["风险等级",company.riskScore]

].map(

(item,index)=>(


<div

key={index}

className="
border
border-gray-800
rounded-xl
p-5
"


>


<p className="
text-gray-400
">

{item[0]}

</p>


<p className="
text-3xl
font-bold
mt-3
">

{item[1]}

</p>


</div>


)

)


}


</section>








{/* AI价值优势 */}


<section className="
mt-10
border
border-gray-800
rounded-xl
p-8
">


<h2 className="
text-2xl
font-bold
mb-5
">

AI价值优势

</h2>



{

score.advantages.length>0?


score.advantages.map(

(item,index)=>(


<p

key={index}

className="
text-gray-300
mb-3
"

>

✓ {item}

</p>


)


)


:


<p className="
text-gray-400
">

暂无明显优势

</p>


}



</section>









{/* AI风险分析 */}


<section className="
mt-10
border
border-gray-800
rounded-xl
p-8
">


<h2 className="
text-2xl
font-bold
mb-5
">

AI风险分析

</h2>



{

score.risks.length>0?


score.risks.map(

(item,index)=>(


<p

key={index}

className="
text-gray-300
mb-3
"

>

⚠ {item}

</p>


)


)


:


<p className="
text-gray-400
">

暂无明显风险

</p>


}



</section>










{/* AI投资研究报告 */}


<section className="
mt-10
border
border-gray-800
rounded-xl
p-8
">


<h2 className="
text-3xl
font-bold
mb-8
">

AI投资研究报告

</h2>

<div className="
flex
gap-5
mb-8
">


<InvestmentExport

content={markdown}

filename={`${company.name}-AI投资报告.md`}

/>

<InvestmentPDF

title={`${company.name} AI投资研究报告`}

content={markdown}

/>

</div>


<div className="
space-y-8
text-gray-300
leading-8
">





<div>

<h3 className="
text-xl
font-bold
text-white
">

一、项目概览

</h3>


<p>

{report.overview}

</p>

</div>







<div>

<h3 className="
text-xl
font-bold
text-white
">

二、商业模式分析

</h3>


<p>

{report.business}

</p>

</div>







<div>

<h3 className="
text-xl
font-bold
text-white
">

三、技术竞争力分析

</h3>


<p>

{report.technology}

</p>

</div>







<div>

<h3 className="
text-xl
font-bold
text-white
">

四、市场空间分析

</h3>


<p>

{report.market}

</p>

</div>







<div>

<h3 className="
text-xl
font-bold
text-white
">

五、成长趋势分析

</h3>


<p>

{report.growth}

</p>

</div>







<div>

<h3 className="
text-xl
font-bold
text-white
">

六、风险因素分析

</h3>


<p>

{report.risk}

</p>

</div>







<div>

<h3 className="
text-xl
font-bold
text-white
">

七、AI投资总结

</h3>


<p>

{report.summary}

</p>

</div>





</div>


</section>





</div>


</main>


);


}