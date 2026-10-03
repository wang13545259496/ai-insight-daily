import {
analyzeDuplicate
}
from "../lib/news/smartDuplicate";



const result =
analyzeDuplicate(

{
title:
"OpenAI 发布新一代人工智能模型",

source:
"OpenAI 官方博客",

createdAt:
new Date("2026-09-29")
},


{
title:
"OpenAI发布新模型能力",

source:
"Google AI Blog",

createdAt:
new Date("2026-09-29")
}

);



console.log(result);