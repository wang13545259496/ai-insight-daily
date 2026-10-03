import { PrismaClient } from "@prisma/client";

import {
  isSimilarTitle
} from "../lib/news/deduplicate";


const prisma = new PrismaClient();



async function main(){


console.log("开始检测新闻重复...");



const news =
await prisma.news.findMany({

orderBy:{
createdAt:"desc"
}

});



console.log(
`当前新闻数量:${news.length}`
);



let duplicateCount=0;



for(
let i=0;
i<news.length;
i++
){


for(
let j=i+1;
j<news.length;
j++
){


const similar =
isSimilarTitle(
news[i].title,
news[j].title
);



if(similar){


duplicateCount++;


console.log(
"\n发现可能重复:"
);


console.log(
"新闻1:",
news[i].title
);


console.log(
"新闻2:",
news[j].title
);


console.log(
"来源:",
news[i].source,
"/",
news[j].source
);


}



}


}



console.log(
`\n检测完成，发现${duplicateCount}组可能重复`
);



}



main()

.catch((error)=>{

console.error(error);

process.exit(1);

})

.finally(async()=>{

await prisma.$disconnect();

});