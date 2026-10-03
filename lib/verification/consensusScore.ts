import type { SourceMatchResult } from "./sourceMatcher";

import type { CrossCheckResult } from "./crossCheck";





export interface ConsensusScoreResult {


  finalScore:number;


  level:
    | "high"
    | "medium"
    | "low";


  explanation:string[];


}









/**
 * V7.4.6.4.3
 *
 * 综合可信评分算法
 *
 * 权重：
 *
 * 原始核验评分 50%
 *
 * 来源可信度 30%
 *
 * 多源一致性 20%
 *
 */





export function calculateConsensusScore(

baseScore:number,

sourceResult:SourceMatchResult,

crossResult:CrossCheckResult

):ConsensusScoreResult {





const explanation:string[]=[];





// 1. 基础评分

let finalScore =

baseScore * 0.5;





explanation.push(

`基础真实性评分 ${baseScore}`

);








// 2. 来源评分


finalScore +=

sourceResult.score * 0.3;



explanation.push(

`${sourceResult.reason}，来源评分 ${sourceResult.score}`

);







// 3. 多源一致性评分


finalScore +=

crossResult.consistencyScore * 0.2;



explanation.push(

`${crossResult.reason}，一致性评分 ${crossResult.consistencyScore}`

);







// 限制范围


finalScore = Math.round(

Math.max(

0,

Math.min(

100,

finalScore

)

)

);







let level:

"high"

|

"medium"

|

"low";







if(finalScore>=85){


level="high";


}

else if(finalScore>=60){


level="medium";


}

else{


level="low";


}








return {


finalScore,


level,


explanation



};



}