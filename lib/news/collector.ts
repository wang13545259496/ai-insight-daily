import { PrismaClient } from "@prisma/client";
import Parser from "rss-parser";


const prisma = new PrismaClient();

const parser = new Parser();



interface RSSItem {

title?:string;

link?:string;

content?:string;

contentSnippet?:string;

pubDate?:string;

}



export async function collectNews(){


console.log("开始采集 AI 新闻...");


const sources = await prisma.source.findMany({

where:{

enabled:true,

type:"rss"

}

});



for(const source of sources){


if(!source.rssUrl){

continue;

}



console.log(
`正在采集: ${source.name}`
);



try{


const feed = await parser.parseURL(
source.rssUrl
);



for(const item of feed.items as RSSItem[]){


if(!item.title){

continue;

}



const exists =
await prisma.news.findFirst({

where:{

title:item.title

}

});



if(exists){

continue;

}



await prisma.news.create({

data:{


title:item.title,


category:"AI新闻",


background:
`${source.name} 发布最新人工智能动态`,


summary:
item.contentSnippet ||
"暂无摘要",


content:
item.content ||
item.contentSnippet ||
"",


source:
source.name,


sourceUrl:
item.link || null,


verified:false


}

});


console.log(
`新增新闻:${item.title}`
);


}



await prisma.source.update({

where:{
id:source.id
},

data:{

lastFetch:new Date(),

status:"active"

}

});


}

catch(error){


console.error(

`采集失败:${source.name}`,

error

);



await prisma.source.update({

where:{
id:source.id
},

data:{

status:"error"

}

});


}



}


console.log(
"AI新闻采集完成"
);


}


