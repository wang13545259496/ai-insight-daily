import {
  businessOpportunityData,
  BusinessOpportunity
}
from "@/data/businessOpportunity";


import {
  calculateBusinessScore
}
from "@/lib/businessScore";





export interface RankedBusinessOpportunity
extends BusinessOpportunity{

rankingScore:number;

level:string;

}






export function getBusinessRanking(){



const ranking:RankedBusinessOpportunity[] =


businessOpportunityData.map((item)=>{


const score =

calculateBusinessScore({

marketSize:item.marketSize,

growthRate:item.growthRate,

enterpriseDemand:item.enterpriseDemand,

maturity:item.maturityScore

});





let level="普通机会";



if(score>=90){

level="🔥 高潜机会";

}

else if(score>=80){

level="⭐ 优质机会";

}

else if(score>=70){

level="📈 成长期机会";

}






return {


...item,


rankingScore:score,


level

};


});





return ranking.sort(

(a,b)=>

b.rankingScore-a.rankingScore

);


}