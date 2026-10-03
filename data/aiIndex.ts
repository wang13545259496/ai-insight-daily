import { calculateAIIndex } from "./aiDynamicEngine";



const dynamicIndex = calculateAIIndex();





export const aiIndex = {


title:

"今日AI综合指数",



value:

dynamicIndex.value,



desc:

"根据AI资讯热度、模型能力、Agent生态和创业活跃度动态计算生成。"



};






export const aiIndexDetail = {


newsScore:

dynamicIndex.detail.newsScore,



modelScore:

dynamicIndex.detail.modelScore,



agentScore:

dynamicIndex.detail.agentScore,



startupScore:

dynamicIndex.detail.startupScore



};





export const aiIndexUpdateTime = {


time:

dynamicIndex.time


};