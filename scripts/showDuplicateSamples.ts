import { PrismaClient } from "@prisma/client";

import {
  analyzeDuplicate
} from "../lib/news/smartDuplicate";


const prisma =
new PrismaClient();



async function main(){


const news =
await prisma.news.findMany({

take:100,

select:{

id:true,

title:true,

source:true,

createdAt:true

},

orderBy:{

createdAt:"desc"

}

});



let count=0;



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


const result =
analyzeDuplicate(
news[i],
news[j]
);



if(
result.duplicateScore>=0.9
){


console.log(
"\n================="
);


console.log(
"A:",
news[i].title
);


console.log(
"B:",
news[j].title
);



console.log(
result
);



count++;


if(count>=10){

process.exit();

}


}


}


}



}



main()

.finally(
async()=>{
await prisma.$disconnect();
}
);