import { prisma } from "@/lib/prisma";


function cleanHtml(html:string){

if(!html){
return "";
}


let text=html;


// 删除script
text=text.replace(
/<script[\s\S]*?<\/script>/gi,
""
);


// 删除style
text=text.replace(
/<style[\s\S]*?<\/style>/gi,
""
);


// 删除图片
text=text.replace(
/<img[^>]*>/gi,
""
);


// 删除JS代码块
text=text.replace(
/\(function[\s\S]*?\}\)\(.*?\);?/gi,
""
);


// 删除常见JS
text=text.replace(
/(window\.|document\.|gtag\(|collectEvent|dataLayer|function\s*\()/gi,
""
);


// 删除JSON-LD
text=text.replace(
/\{["@']@context[\s\S]*?\}/gi,
""
);


// 删除HTML
text=text.replace(
/<[^>]+>/g,
""
);


// HTML实体

text=text.replace(/&nbsp;/g," ");

text=text.replace(/&amp;/g,"&");

text=text.replace(/&lt;/g,"<");

text=text.replace(/&gt;/g,">");


// 清理空白

text=text.replace(
/\s+/g,
" "
);


return text.trim();

}



function isBadContent(text:string){

if(!text){
return true;
}


// 太短

if(text.length<80){
return true;
}


// 官网导航污染

const badWords=[

"关于我们",
"加入我们",
"联系我们",
"投资者关系",
"下载",
"扫码下载",
"京ICP备",
"版权所有",
"客服热线",
"意见反馈"

];


let count=0;


for(const word of badWords){

if(text.includes(word)){
count++;
}

}


return count>=3;

}



async function main(){

console.log(
"开始深度清洗新闻正文..."
);


const list=await prisma.news.findMany({

select:{
id:true,
title:true,
content:true,
summary:true
}

});


let clean=0;

let bad=0;


for(const news of list){


const result=cleanHtml(
news.content || ""
);


if(isBadContent(result)){


await prisma.news.update({

where:{
id:news.id
},

data:{

dataStatus:"inactive",

cleanReason:
"正文污染或低质量内容"

}

});


bad++;

console.log(
"标记低质量:",
news.title
);


continue;

}



await prisma.news.update({

where:{
id:news.id
},

data:{

content:result,
summary:cleanHtml(news.summary || "")

}

});


clean++;


}


console.log(
"正文清洗完成",
{
clean,
bad
}
);


await prisma.$disconnect();

}


main();
