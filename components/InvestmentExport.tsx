"use client";


interface Props{

content:string;

filename:string;

}



export default function InvestmentExport({

content,

filename

}:Props){



function download(){


const blob =
new Blob(

[content],

{

type:"text/markdown"

}

);



const url =
URL.createObjectURL(blob);



const a =
document.createElement("a");


a.href=url;


a.download=
filename;



a.click();



URL.revokeObjectURL(url);



}





return (

<button

onClick={download}

className="
border
border-gray-700
px-5
py-3
rounded
hover:bg-white
hover:text-black
transition
"

>

导出 Markdown报告

</button>


);


}