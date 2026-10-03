export interface ScoreInput {


marketSize:number;
// 市场规模 0-100


growthRate:number;
// 增长速度 0-100


enterpriseDemand:number;
// 企业需求 0-100


maturity:number;
// 商业成熟度 0-100

}



export function calculateBusinessScore(

data:ScoreInput

){



const score =

data.marketSize * 0.30

+

data.growthRate * 0.25

+

data.enterpriseDemand * 0.25

+

data.maturity * 0.20;



return Math.round(score);


}