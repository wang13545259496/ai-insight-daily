interface StatItem {

title:string;

value:string;

desc:string;

}



interface HomeStatsProps {

stats:StatItem[];

}




export default function HomeStats({

stats

}:HomeStatsProps){



return (


<div

className="
grid
md:grid-cols-4
gap-6
"

>


{


stats.map(item=>(


<div


key={item.title}


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
text-gray-400
text-sm
mb-3
"


>

{item.title}

</h3>





<p


className="
text-4xl
font-bold
"

>

{item.value}

</p>





<p


className="
text-gray-500
mt-3
"

>

{item.desc}

</p>



</div>


))


}



</div>


)


}