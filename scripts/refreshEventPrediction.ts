import { prisma } from "../lib/prisma";


import {

predictEventTrend

} from "../lib/events/eventPredictor";





async function refreshEventPrediction(){



console.log(
"📈 开始事件趋势预测..."
);




const events =
await prisma.newsEvent.findMany({

include:{

news:true

}

});





for(
const event of events
){



const result =
predictEventTrend(
event.news
);




await prisma.newsEvent.update({

where:{

id:event.id

},


data:{


trendSummary:
result.prediction


}


});





console.log(

`✅ ${event.title}

增长率:
${result.growth}%

预测:
${result.prediction}`

);



}




console.log(
"🎉 趋势预测完成"
);


}





refreshEventPrediction()

.catch(error=>{


console.error(error);


process.exit(1);


})

.finally(async()=>{


await prisma.$disconnect();


});