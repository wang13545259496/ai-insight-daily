"use client";


import jsPDF from "jspdf";



export default function InvestmentPDF({

title,

content

}:{

title:string;

content:string;

}){


function createPDF(){


const pdf = new jsPDF();


pdf.setFontSize(16);


pdf.text(
title,
20,
20
);



pdf.setFontSize(10);


const lines =
pdf.splitTextToSize(
content,
170
);



pdf.text(
lines,
20,
40
);



pdf.save(
`${title}.pdf`
);


}



return (

<button

onClick={createPDF}

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

生成PDF报告

</button>

);


}