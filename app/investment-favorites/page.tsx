import {
prisma
}
from "@/lib/prisma";



export default async function InvestmentFavoritesPage(){


const favorites =
await prisma.investmentFavorite.findMany({

include:{

Investment:true

},


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
max-w-5xl
mx-auto
">


<h1 className="
text-4xl
font-bold
">

我的AI投资关注

</h1>



<div className="
mt-10
space-y-5
">


{

favorites.map(

(item)=>(


<div

key={item.id}

className="
border
border-gray-800
rounded-xl
p-6
"


>


<h2 className="
text-2xl
font-bold
">

⭐ {item.Investment.name}

</h2>


<p className="
text-gray-400
mt-2
">

{item.Investment.industry}

</p>



<p className="
mt-3
">

投资评分：

{item.Investment.businessScore}

</p>



</div>


)


)


}



</div>


</div>


</main>


);


}