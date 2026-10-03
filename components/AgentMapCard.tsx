interface AgentMapCardProps {

category:string;

agent:string;

scene:string;

direction:string;

description:string;

}



export default function AgentMapCard({

category,

agent,

scene,

direction,

description

}:AgentMapCardProps){



return (


<div

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
text-2xl
font-bold
mb-4
"

>

{category}

</h3>




<h4

className="
text-xl
font-semibold
mb-4
"

>

{agent}

</h4>





<p

className="
text-gray-400
mb-3
"

>

应用场景：

{scene}

</p>





<p

className="
text-gray-400
mb-3
"

>

商业方向：

{direction}

</p>





<p

className="
text-gray-500
leading-7
"

>

{description}

</p>




</div>


)


}