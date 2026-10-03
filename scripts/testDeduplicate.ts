import {
  isSimilarTitle
} from "../lib/news/deduplicate";


const title1 =
"OpenAI 发布新一代人工智能模型";


const title2 =
"OpenAI发布新一代人工智能模型";


const title3 =
"Google 推出新的 AI Agent 技术";


console.log(
"测试1:",
isSimilarTitle(title1,title2)
);


console.log(
"测试2:",
isSimilarTitle(title1,title3)
);