"use client";

import { useState } from "react";


export default function AIPage(){


const [title,setTitle]=useState("");

const [content,setContent]=useState("");

const [result,setResult]=useState("");



async function generate(){


const res = await fetch("/api/ai/summary",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

title,

content

})

});


const data = await res.json();


setResult(
data.data.summary
);


}



return (

<main className="p-10">


<h1 className="text-3xl font-bold">

AI 新闻摘要生成

</h1>



<input

className="border p-3 w-full mt-5"

placeholder="新闻标题"

value={title}

onChange={e=>setTitle(e.target.value)}

/>



<textarea

className="border p-3 w-full mt-5"

placeholder="新闻内容"

rows={6}

value={content}

onChange={e=>setContent(e.target.value)}

/>



<button

className="bg-black text-white px-6 py-3 mt-5 rounded"

onClick={generate}

>

生成摘要

</button>



<div className="mt-8 border p-5">

{result}

</div>



</main>

)

}