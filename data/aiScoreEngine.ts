import { news } from "./news";
import { models } from "./models";
import { agents } from "./agents";
import { startupIdeas } from "./startupIdeas";



export function calculateAIIndex(){



// AI资讯热度评分

const newsScore = Math.min(
  news.length * 5 + 60,
  100
);




// 模型生态评分

const modelScore = Math.min(
  models.length * 8 + 70,
  100
);




// Agent生态评分

const agentScore = Math.min(
  agents.length * 8 + 60,
  100
);




// 创业活跃评分

const startupScore = Math.min(
  startupIdeas.length * 8 + 55,
  100
);





// 综合指数计算

const total = Math.round(

  newsScore * 0.25 +

  modelScore * 0.25 +

  agentScore * 0.25 +

  startupScore * 0.25

);



return {


total,


detail:{


newsScore,


modelScore,


agentScore,


startupScore


}



};


}