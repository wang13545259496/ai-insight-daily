export default function IndexDetailCard({

icon,

title,

value


}:{

icon:string;

title:string;

value:number;


}){


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


<div

className="
text-3xl
mb-4
"

>

{icon}

</div>




<h3

className="
text-lg
font-bold
mb-4
"

>

{title}

</h3>




<div

className="
text-4xl
font-bold
"

>

{value}

</div>



</div>

)

}