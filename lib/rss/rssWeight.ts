export function calculateRSSWeight({

score,
responseTime,
successRate,
failCount

}:{

score:number;

responseTime:number;

successRate:number;

failCount:number;

}){


let weight = 0;



// 健康评分

weight += score * 0.5;



// 响应速度

if(responseTime < 1000){

    weight += 25;

}

else if(responseTime < 3000){

    weight += 15;

}

else{

    weight += 5;

}



// 成功率

weight += successRate * 0.2;



// 失败惩罚

weight -= failCount * 10;



if(weight < 0){

    weight = 0;

}


if(weight > 100){

    weight = 100;

}



return Math.round(weight);


}