"use client";


import {

Radar,

RadarChart,

PolarGrid,

PolarAngleAxis,

PolarRadiusAxis,

ResponsiveContainer

} from "recharts";




interface Props{


market:number;


technology:number;


profit:number;


competition:number;


difficulty:number;


}





export default function BusinessRadar({

market,

technology,

profit,

competition,

difficulty

}:Props){



const data=[


{

subject:"市场机会",

value:market

},


{

subject:"技术成熟度",

value:technology

},



{

subject:"盈利潜力",

value:profit

},



{

subject:"竞争压力",

value:competition

},



{

subject:"创业难度",

value:difficulty

}



];





return (

<div className="bg-gray-900 rounded-2xl p-8">


<h2 className="text-2xl font-bold mb-6">

📊 AI商业机会雷达图

</h2>



<div className="h-[400px]">


<ResponsiveContainer width="100%" height="100%">


<RadarChart data={data}>


<PolarGrid />


<PolarAngleAxis

dataKey="subject"

/>


<PolarRadiusAxis

angle={30}

domain={[0,100]}

/>



<Radar

dataKey="value"

stroke="#ffffff"

fill="#ffffff"

fillOpacity={0.25}

/>



</RadarChart>


</ResponsiveContainer>



</div>


</div>

)


}