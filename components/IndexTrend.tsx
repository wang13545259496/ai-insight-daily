export default function IndexTrend({

data

}:{

data:{
date:string;
value:number;
}[]

}){


return (


<div

className="
border
border-gray-800
rounded-2xl
p-8
bg-neutral-950
"

>


<h2

className="
text-2xl
font-bold
mb-8
"

>

AI指数7日趋势

</h2>




<div

className="
space-y-5
"

>


{

data.map(item=>(


<div

key={item.date}

className="
flex
justify-between
items-center
border-b
border-gray-800
pb-3
"

>


<span

className="
text-gray-400
"

>

{item.date}

</span>




<span

className="
text-3xl
font-bold
"

>

{item.value}

</span>



</div>


))


}


</div>



</div>


)


}