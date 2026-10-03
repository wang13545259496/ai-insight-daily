export interface InvestmentScoreInput {


businessScore:number;


// 技术壁垒

technologyScore:number;


// 市场空间

marketScore:number;


// 成长速度

growthScore:number;


// 风险控制

riskScore:number;


}



export interface InvestmentScoreResult {


total:number;


level:string;


description:string;


advantages:string[];


risks:string[];

}




export function calculateInvestmentScore(

data:InvestmentScoreInput

):InvestmentScoreResult{



const total = Math.round(

data.businessScore * 0.25 +

data.technologyScore * 0.20 +

data.marketScore * 0.20 +

data.growthScore * 0.20 +

data.riskScore * 0.15

);



let level="";

let description="";



if(total>=90){

level="A级";

description="高成长投资价值";

}

else if(total>=80){

level="B级";

description="成长型投资机会";

}

else if(total>=70){

level="C级";

description="持续观察机会";

}

else{

level="D级";

description="风险关注项目";

}



const advantages:string[]=[];


if(data.marketScore>=85){

advantages.push(
"市场空间较大"
);

}


if(data.technologyScore>=85){

advantages.push(
"技术壁垒较强"
);

}


if(data.growthScore>=85){

advantages.push(
"成长速度较快"
);

}



const risks:string[]=[];



if(data.riskScore<50){

risks.push(
"商业化风险需要关注"
);

}


if(data.technologyScore<70){

risks.push(
"技术竞争压力较大"
);

}



return {


total,


level,


description,


advantages,


risks


};


}