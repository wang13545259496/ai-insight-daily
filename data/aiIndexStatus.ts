export function getAIIndexStatus(
  value:number
){


if(value >= 90){


return {


level:"高速增长",


icon:"🔥",


color:"text-green-400",


desc:
"AI生态活跃度较高，模型、Agent和商业应用持续扩张。"


};


}



if(value >= 80){


return {


level:"稳定发展",


icon:"📈",


color:"text-blue-400",


desc:
"AI产业保持稳定增长，技术和应用持续推进。"


};


}



if(value >= 60){


return {


level:"调整阶段",


icon:"⚖️",


color:"text-yellow-400",


desc:
"AI生态正在调整，部分技术方向进入优化阶段。"


};


}




return {


level:"低活跃",


icon:"⚠️",


color:"text-red-400",


desc:
"AI生态活跃度较低，需要关注产业变化。"


};


}