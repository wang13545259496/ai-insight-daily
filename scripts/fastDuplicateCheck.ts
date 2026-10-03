import { PrismaClient } from "@prisma/client";

import {
createTitleHash,
isSimilarTitle
} from "../lib/news/deduplicate";


const prisma =
new PrismaClient();



async function main(){


console.log(
"开始高速新闻去重检测..."
);



const news =
await prisma.news.findMany({

select:{

id:true,

title:true,

source:true,

createdAt:true

}

});



console.log(
`新闻数量:${news.length}`
);



const groups =
new Map<number,typeof news>();



for(const item of news){


const hash =
createTitleHash(
item.title
);



if(!groups.has(hash)){

groups.set(
hash,
[]
);

}


groups
.get(hash)!
.push(item);


}



console.log(
`生成分组:${groups.size}`
);



let count=0;



for(
const group of groups.values()
){


if(group.length<2){

continue;

}



for(
let i=0;
i<group.length;
i++
){


for(
let j=i+1;
j<group.length;
j++
){


if(
isSimilarTitle(
group[i].title,
group[j].title
)
){


count++;


console.log("\n重复候选:");

console.log(
"1:",
group[i].title
);


console.log(
"2:",
group[j].title
);


console.log(
"来源:",
group[i].source,
"/",
group[j].source
);


}


}

}

}


console.log(
`\n检测结束，共发现${count}组`
);


}



main()

.catch(console.error)

.finally(async()=>{

await prisma.$disconnect();

});