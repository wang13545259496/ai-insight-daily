interface AgentGraphNode {

id:number;

name:string;

type:string;

category:string;

description:string;

}



interface AgentGraphProps {

nodes:AgentGraphNode[];

}




export default function AgentGraph({

nodes

}:AgentGraphProps){



return (


<div

className="
border
border-gray-800
rounded-3xl
bg-neutral-950
p-10
"

>



<h2

className="
text-3xl
font-bold
text-center
mb-12
"

>

AI Agent生态网络

</h2>






<div

className="
flex
justify-center
mb-12
"

>


<div

className="
w-48
h-48
rounded-full
border
border-white
flex
items-center
justify-center
text-center
font-bold
text-xl
bg-black
"

>


AI Agent

生态中心


</div>


</div>









<div

className="
grid
md:grid-cols-3
gap-8
"

>


{


nodes

.filter(node=>node.name!=="AI Agent生态中心")

.map(node=>(


<div

key={node.id}

className="
border
border-gray-700
rounded-2xl
p-6
bg-black
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

{node.name}

</h3>




<p

className="
text-gray-400
mb-2
"

>

类型：

{node.type}

</p>




<p

className="
text-gray-400
mb-2
"

>

方向：

{node.category}

</p>




<p

className="
text-gray-400
leading-7
"

>

{node.description}

</p>




</div>


))


}



</div>







</div>


)


}