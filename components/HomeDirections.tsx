interface DirectionItem {


name:string;


desc:string;


}




interface HomeDirectionsProps {


directions:DirectionItem[];


}





export default function HomeDirections({

directions

}:HomeDirectionsProps){



return (


<section>


<h2


className="
text-3xl
font-bold
mb-8
"

>

AI产业发展方向

</h2>





<div


className="
grid
md:grid-cols-4
gap-6
"

>


{


directions.map(item=>(


<div


key={item.name}


className="
border
border-gray-800
rounded-2xl
p-6
bg-neutral-950
hover:border-white
transition
"

>


<h3


className="
text-xl
font-bold
mb-3
"

>

{item.name}

</h3>




<p


className="
text-gray-400
leading-7
"

>

{item.desc}

</p>




</div>


))


}



</div>



</section>


)


}