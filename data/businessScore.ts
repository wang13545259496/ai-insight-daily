export interface BusinessScore {


businessId:number;


market:number;


technology:number;


profit:number;


competition:number;


difficulty:number;


}



export const businessScores:BusinessScore[]=[



{
businessId:7,

market:90,

technology:85,

profit:88,

competition:70,

difficulty:60
},



{
businessId:8,

market:86,

technology:82,

profit:90,

competition:75,

difficulty:65
},



{
businessId:9,

market:84,

technology:80,

profit:85,

competition:68,

difficulty:55
}



];





export function calculateBusinessScore(

score:BusinessScore

){


return Math.round(

(

score.market+

score.technology+

score.profit+

(100-score.competition)+

(100-score.difficulty)

)/5

);


}