import BusinessRanking from "@/components/BusinessRanking";



export default function BusinessCenterPage(){


return (

<main className="min-h-screen bg-black text-white px-8 py-12">


<div className="max-w-6xl mx-auto">


<h1 className="text-5xl font-bold">

AI商业智能决策中心

</h1>



<p className="text-gray-400 mt-5 text-lg">

通过AI分析行业趋势、商业机会和创业方向。

</p>




<BusinessRanking />



<section className="mt-12 grid md:grid-cols-3 gap-6">



<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

📊 行业趋势

</h3>


<p className="mt-4 text-gray-400">

分析AI产业发展方向和市场机会。

</p>


</div>





<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

🚀 创业机会

</h3>


<p className="mt-4 text-gray-400">

发现适合创业的新兴AI领域。

</p>


</div>





<div className="bg-gray-900 rounded-xl p-6">


<h3 className="text-xl font-bold">

💡 商业决策

</h3>


<p className="mt-4 text-gray-400">

辅助企业制定AI转型策略。

</p>


</div>



</section>



</div>


</main>


)

}