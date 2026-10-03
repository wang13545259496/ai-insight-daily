"use client";


import { useState } from "react";


import { searchData } from "@/data/searchData";





export default function AISearchPage(){



const [keyword,setKeyword] = useState("");

const [results,setResults] = useState(searchData);





function handleSearch(){


const value = keyword.toLowerCase();



if(!value){


setResults(searchData);

return;


}



const filtered = searchData.filter(item=>


(
item.title +

item.type +

item.keyword +

item.description

)

.toLowerCase()

.includes(value)


);



setResults(filtered);



}





return (



<main

className="
min-h-screen
bg-black
text-white
p-10
"

>


<section

className="
max-w-6xl
mx-auto
"

>



<h1

className="
text-5xl
font-bold
mb-5
"

>

AI智能搜索

</h1>




<p

className="
text-gray-400
text-xl
mb-10
"

>

搜索AI资讯、Agent应用、行业趋势和商业机会

</p>








<div

className="
flex
gap-4
mb-12
"

>


<input


value={keyword}


onChange={(e)=>setKeyword(e.target.value)}


placeholder="例如：AI客服、AI编程、企业自动化"


className="
flex-1
bg-neutral-950
border
border-gray-700
rounded-xl
p-4
outline-none
"

 />





<button


onClick={handleSearch}


className="
border
border-white
rounded-xl
px-8
hover:bg-white
hover:text-black
transition
"

>

智能搜索

</button>



</div>









<section>



<h2

className="
text-3xl
font-bold
mb-8
"

>

搜索结果

</h2>





{

results.length===0 && (


<div

className="
border
border-gray-800
rounded-2xl
p-8
text-gray-400
"

>


暂无相关结果


</div>


)


}








<div

className="
space-y-6
"

>


{


results.map(item=>(


<div


key={item.id}


className="
border
border-gray-800
rounded-2xl
p-8
bg-neutral-950
hover:border-white
transition
"

>



<div

className="
flex
justify-between
items-center
mb-4
"

>


<h3

className="
text-2xl
font-bold
"

>

{item.title}

</h3>



<span

className="
text-sm
border
border-gray-700
rounded-full
px-4
py-1
text-gray-300
"

>

{item.type}

</span>



</div>







<p

className="
text-gray-400
mb-4
"

>

关键词：

{item.keyword}

</p>





<p

className="
text-gray-300
leading-7
"

>

{item.description}

</p>




</div>


))


}



</div>



</section>









<section

className="
mt-16
border
border-gray-800
rounded-2xl
p-8
bg-neutral-950
"

>


<h2

className="
text-3xl
font-bold
mb-4
"

>

AI产业智能分析中心

</h2>



<p

className="
text-gray-400
leading-8
"

>

未来这里将连接AI新闻数据库、Agent生态库、
行业趋势模型和商业机会分析系统。

</p>



</section>







</section>


</main>



)


}