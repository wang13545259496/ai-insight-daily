"use client";


import {

Radar,

RadarChart,

PolarGrid,

PolarAngleAxis,

PolarRadiusAxis,

ResponsiveContainer

} from "recharts";



interface Props {


business:number;


technology:number;


market:number;


growth:number;


risk:number;


}



export default function InvestmentRadar({

business,

technology,

market,

growth,

risk

}:Props){



const data=[


{

subject:"商业模式",

value:business

},


{

subject:"技术壁垒",

value:technology

},


{

subject:"市场空间",

value:market

},


{

subject:"成长能力",

value:growth

},


{

subject:"风险控制",

value:risk

}


];




return (


<div className="
w-full
h-[400px]
">


<ResponsiveContainer>


<RadarChart data={data}>


<PolarGrid />


<PolarAngleAxis

dataKey="subject"

/>


<PolarRadiusAxis

domain={[0,100]}

/>



<Radar

name="AI投资价值"

dataKey="value"

fillOpacity={0.6}

/>



</RadarChart>


</ResponsiveContainer>



</div>


);


}