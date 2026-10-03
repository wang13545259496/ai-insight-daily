export function similarity(

a:string,

b:string

){



const textA =
a.toLowerCase();



const textB =
b.toLowerCase();




const wordsA =
new Set(
textA.split("")
);



const wordsB =
new Set(
textB.split("")
);




const intersection =
[
...wordsA
]
.filter(
x=>wordsB.has(x)
)
.length;




const union =
new Set(
[
...wordsA,
...wordsB
]
)
.size;



return Math.round(
intersection /
union
*
100
);


}