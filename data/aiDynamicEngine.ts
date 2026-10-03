import { news } from "./news";
import { models } from "./models";
import { agents } from "./agents";
import { startupIdeas } from "./startupIdeas";





export function calculateAIIndex(){



// 新闻热度评分

const newsScore = Math.min(

news.length * 5,

100

);




// 模型能力评分

const modelScore = Math.min(

models.reduce(

(sum,item)=>sum + item.score,

0

)

/

models.length,

100

);





// Agent生态评分

const agentScore = Math.min(

agents.length * 10,

100

);





// 创业活跃评分

const startupScore = Math.min(

startupIdeas.length * 10,

100

);







// 综合指数计算


const total = Math.round(

newsScore * 0.25 +

modelScore * 0.35 +

agentScore * 0.25 +

startupScore * 0.15

);






return {


value: total,


detail:{


newsScore:


Math.round(newsScore),



modelScore:


Math.round(modelScore),



agentScore:


Math.round(agentScore),



startupScore:


Math.round(startupScore)



},



time:

new Date().toLocaleString("zh-CN")



};


}