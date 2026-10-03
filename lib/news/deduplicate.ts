export function normalizeTitle(title:string){

return title

.toLowerCase()

.replace(/\s+/g,"")

.replace(/[：:，,。.!！?？、]/g,"")

.replace(
/[\u3000-\u303F\uFF00-\uFFEF]/g,
""
);

}



export function getTitleKeywords(
title:string
){

const text =
normalizeTitle(title);


const words =
text.match(
/[A-Za-z]+|[\u4e00-\u9fa5]{2,}/g
)
||[];


return words
.slice(0,5)
.join("");

}



export function createTitleHash(
title:string
){

const keywords =
getTitleKeywords(title);


let hash=0;


for(
let i=0;
i<keywords.length;
i++
){

hash =
((hash<<5)-hash)
+
keywords.charCodeAt(i);

hash |=0;

}


return Math.abs(hash);

}



export function isSimilarTitle(
title1:string,
title2:string
){


const a =
normalizeTitle(title1);


const b =
normalizeTitle(title2);



if(a===b){

return true;

}



const short =
a.length<b.length?a:b;


let count=0;



for(
const char of short
){

if(
a.includes(char)
&&
b.includes(char)
){

count++;

}

}



return (
count / short.length
)>0.75;


}