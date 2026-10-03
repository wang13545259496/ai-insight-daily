export default function ScoreCard(

{
name,
score
}:{
name:string,
score:number
}

){


return (

<div

className="
bg-zinc-950
border
border-zinc-800
rounded-xl
p-6
"

>


<div
className="
flex
justify-between
"
>


<h3
className="
text-xl
font-bold
"
>
{name}
</h3>


<span
className="
text-green-400
text-2xl
"
>
{score}
</span>


</div>


</div>

)

}