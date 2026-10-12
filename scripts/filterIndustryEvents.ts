import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


function isLowValue(title:string){

const words=[

"Gym",
"Dota",
"Contest",
"Benchmark",
"Bench",
"Research",
"Workshop",
"Tutorial",
"Paper",
"Unconference",
"Challenge",
"Prize",
"Dataset",
"Safety overview"

];


return words.some(
w=>title.toLowerCase().includes(w.toLowerCase())
);

}



async function main(){


console.log(
"开始过滤低价值AI事件..."
);



const events =
await prisma.newsEvent.findMany();



let removed=0;



for(const event of events){


if(
!isLowValue(event.title)
){

continue;

}



await prisma.news.updateMany({

where:{
eventId:event.id
},

data:{
eventId:null
}

});



await prisma.newsEvent.delete({

where:{
id:event.id
}

});


removed++;


console.log(
"删除低价值事件:",
event.title
);


}



console.log(
`完成 删除:${removed}`
);


}



main()
.finally(async()=>{

await prisma.$disconnect();

});
