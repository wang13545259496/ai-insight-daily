"use client";


import {
LineChart,
Line,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer,
CartesianGrid
} from "recharts";



interface Props{

data:{
date:string;
value:number;
}[];

}



export default function AIIndexChart({

data

}:Props){



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

AI指数趋势图

</h2>






<div

className="
h-[350px]
"

>


<ResponsiveContainer

width="100%"

height="100%"

>


<LineChart

data={data}

>



<CartesianGrid

strokeDasharray="3 3"

stroke="#222"

/>





<XAxis

dataKey="date"

stroke="#666"

/>





<YAxis

domain={[0,100]}

stroke="#666"

/>







<Tooltip

contentStyle={{

background:"#111",

border:"1px solid #333",

color:"#fff"

}}

/>







<Line

type="monotone"

dataKey="value"

stroke="#ffffff"

strokeWidth={3}

dot={{

r:5,

fill:"#000",

stroke:"#fff",

strokeWidth:2

}}

activeDot={{

r:8

}}

/>





</LineChart>



</ResponsiveContainer>



</div>



</div>



)

}