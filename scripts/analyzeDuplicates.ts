import { PrismaClient } from "@prisma/client";

import {
  analyzeDuplicate
} from "../lib/news/smartDuplicate";


const prisma =
new PrismaClient();




/**
 * 停用词
 */
const stopWords = new Set([

"ai",

"人工智能",

"智能",

"技术",

"科技",

"新闻",

"发布",

"推出",

"更新",

"最新",

"模型",

"系统",

"平台",

"能力",

"应用",

"发展",

"公司",

"企业",

"全球",

"宣布"

]);





/**
 * 提取核心关键词
 */
function extractKeywords(
title:string
):string[]{


const words =
(
title
.toLowerCase()
.match(
/[a-z0-9]+|[\u4e00-\u9fa5]{2,}/g
)
||
[]
);



return Array.from(

new Set(

words.filter(

word =>
!stopWords.has(word)

)

)

)

.filter(

word =>
word.length>=2

);

}





/**
 * 创建候选Key
 *
 * 使用前两个有效关键词
 */
function createGroupKey(

title:string

){


const keywords =
extractKeywords(title);



if(
keywords.length < 2
){

return "";

}



return keywords
.slice(0,2)
.sort()
.join("_");

}







async function main(){


console.log(
"开始智能重复新闻分析..."
);



const news =
await prisma.news.findMany({

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



console.log(
`新闻数量:${news.length}`
);





const groups =
new Map<string,typeof news>();





for(
const item of news
){


const key =
createGroupKey(
item.title
);



if(
!key
){

continue;

}



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





console.log(
`候选分组:${groups.size}`
);






let duplicateGroups = 0;

const highDuplicateNews =
new Set<number>();

const possibleDuplicateNews =
new Set<number>();



let compareCount=0;






for(
const group of groups.values()
){


/**
 * 单组太大直接跳过
 * 防止公共词污染
 */
if(
group.length>50
){

continue;

}



if(
group.length<2
){

continue;

}





let hasDuplicate=false;



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



compareCount++;



const result =
analyzeDuplicate(

group[i],

group[j]

);





if(
result.duplicateScore>=0.9
){


hasDuplicate=true;



highDuplicateNews.add(
group[i].id
);


highDuplicateNews.add(
group[j].id
);



}

else if(

result.duplicateScore>=0.75

){


possibleDuplicateNews.add(
group[i].id
);


possibleDuplicateNews.add(
group[j].id
);


}



}


}





if(
hasDuplicate
){


duplicateGroups++;


}



}





console.log(
"\n==========分析完成=========="
);



console.log(
`候选比较次数:${compareCount}`
);



console.log(
`重复新闻组:${duplicateGroups}`
);



console.log(
`高度重复新闻数量:${highDuplicateNews.size}`
);



console.log(
`可能重复新闻数量:${possibleDuplicateNews.size}`
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