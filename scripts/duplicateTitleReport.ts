import { PrismaClient } from "@prisma/client";


const prisma =
new PrismaClient();



async function main(){


const news =
await prisma.news.findMany({

select:{
title:true
}

});



const map =
new Map<string,number>();



for(
const item of news
){

const title =
item.title.trim();



map.set(
title,
(map.get(title)||0)+1
);

}



const duplicates =
Array.from(map.entries())
.filter(
([_title,count])=>
count>1
)
.sort(
(a,b)=>b[1]-a[1]
);



console.log(
"重复标题数量:",
duplicates.length
);



console.log(
"前50个重复标题:"
);



console.log(
duplicates.slice(0,50)
);



}



main()

.finally(
async()=>{
await prisma.$disconnect();
}
);