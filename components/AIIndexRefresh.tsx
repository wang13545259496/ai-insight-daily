import {
  aiIndexRefresh,
  getAIIndexChange
} from "@/data/aiIndexRefresh";



export default function AIIndexRefresh(){


const change = getAIIndexChange();



return (

<div

className="
border
border-gray-800
rounded-2xl
p-8
bg-neutral-950
"

>


<h2

className="
text-2xl
font-bold
mb-6
"

>

AI指数更新

</h2>





<div

className="
text-5xl
font-bold
"

>

{aiIndexRefresh.currentValue}

</div>






<div

className="
mt-5
text-2xl
text-green-400
"

>


{

change.change >= 0

?

"↑"

:

"↓"

}


{" "}

{Math.abs(change.change)}


</div>







<p

className="
mt-4
text-gray-400
"

>

相比昨日：

{aiIndexRefresh.previousValue}

</p>







<p

className="
mt-4
text-gray-400
"

>

更新时间：

{aiIndexRefresh.lastUpdate}

</p>







<p

className="
mt-4
text-gray-400
"

>

刷新周期：

{aiIndexRefresh.refreshInterval}

</p>






</div>


)


}