import Link from "next/link";



interface LinkItem {


name:string;


path:string;


}



interface HomeLinksProps {


links:LinkItem[];


}




export default function HomeLinks({

links

}:HomeLinksProps){



return (


<div


className="
grid
md:grid-cols-4
gap-6
"

>


{


links.map(item=>(


<Link


key={item.path}


href={item.path}


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


<h3


className="
text-2xl
font-bold
"

>

{item.name}

</h3>



<p


className="
text-gray-400
mt-4
"

>

探索AI产业生态

</p>



</Link>


))


}



</div>


)


}