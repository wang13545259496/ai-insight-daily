import {

getBusinessRecommendation

}

from "@/data/businessRecommendation";




export default function BusinessRecommendation({

businessId

}:{

businessId:number

}){



const data=

getBusinessRecommendation(businessId);



if(!data){

return null;

}





return (



<section className="mt-12">


<h2 className="text-3xl font-bold mb-8">

🚀 AI创业智能推荐

</h2>





<div className="grid md:grid-cols-2 gap-6">





<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

🎯 推荐创业方向

</h3>


<p className="mt-4 leading-8 text-gray-300">

{data.startupDirection}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

👥 目标客户画像

</h3>


<p className="mt-4 leading-8 text-gray-300">

{data.targetCustomer}

</p>


</div>








<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

🧩 产品切入点

</h3>


<p className="mt-4 leading-8 text-gray-300">

{data.productEntry}

</p>


</div>







<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

📈 发展路径

</h3>


<p className="mt-4 leading-8 text-gray-300 whitespace-pre-line">

{data.growthPath}

</p>


</div>




</div>


</section>



)


}