import { PrismaClient } from "@prisma/client";

import {
  analyzeDuplicate
} from "../lib/news/smartDuplicate";


const prisma =
new PrismaClient();



async function main(){


const news =
await prisma.news.findMany({

take:20,

orderBy:{
createdAt:"desc"
},

select:{

title:true,

source:true,

createdAt:true

}

});



console.log(
"读取新闻数量:",
news.length
);



for(
let i=0;
i<5;
i++
){


const a =
news[i];

const b =
news[i+1];



const result =
analyzeDuplicate(
a,
b
);



console.log("\n================");

console.log(
"A:",
a.title
);


console.log(
"B:",
b.title
);



console.log(
result
);



}



}



main()

.finally(
async()=>{
await prisma.$disconnect();
}
);