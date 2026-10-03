import { PrismaClient } from "@prisma/client";


const prisma =
new PrismaClient();



async function main(){


console.log(
"开始清理重复新闻..."
);



const news =
await prisma.news.findMany({

orderBy:{
createdAt:"desc"
}

});



console.log(
`当前新闻数量:${news.length}`
);



const groups =
new Map<string, typeof news>();



for(
const item of news
){


const key =
`${item.title.trim()}_${item.source.trim()}`;



if(
!groups.has(key)
){

groups.set(
key,
[]
);

}



groups
.get(key)!
.push(item);


}





const deleteIds:number[] = [];

let duplicateGroups = 0;



for(
const group of groups.values()
){


if(
group.length<=1
){

continue;

}



duplicateGroups++;



// 排序：

// 1. 有sourceUrl优先

// 2. 时间最新优先

group.sort(
(a,b)=>{


const aUrl =
a.sourceUrl ? 1 : 0;


const bUrl =
b.sourceUrl ? 1 : 0;



if(
aUrl!==bUrl
){

return bUrl-aUrl;

}



return (
b.createdAt.getTime()
-
a.createdAt.getTime()
);


}

);



// 第一条保留

const keep =
group[0];



// 其余删除

const remove =
group
.slice(1)
.map(
item=>item.id
);



deleteIds.push(
...remove
);



console.log(
"\n重复标题:"
);

console.log(
keep.title
);


console.log(
"保留:",
keep.id
);


console.log(
"删除:",
remove
);



}





console.log(
"\n重复组:",
duplicateGroups
);



console.log(
`准备删除数量:${deleteIds.length}`
);



if(
deleteIds.length===0
){

console.log(
"没有需要删除的数据"
);

return;

}





await prisma.news.deleteMany({

where:{

id:{
in:deleteIds
}

}

});




console.log(
"重复新闻清理完成"
);



const count =
await prisma.news.count();



console.log(
`剩余新闻数量:${count}`
);



}



main()

.catch(
error=>{
console.error(error);
}
)

.finally(
async()=>{

await prisma.$disconnect();

}

);