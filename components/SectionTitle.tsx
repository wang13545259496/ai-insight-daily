export default function SectionTitle(

{
title,
desc
}:{
title:string,
desc?:string
}

){


return (

<div
className="
mb-8
"
>


<h2
className="
text-3xl
font-bold
"
>

{title}

</h2>


{
desc &&

<p
className="
mt-3
text-gray-400
"
>
{desc}
</p>

}


</div>


)

}