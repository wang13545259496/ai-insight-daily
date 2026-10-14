import { prisma } from "../lib/prisma";


import {

calculateEventScore,

calculateTrendStatus,

generateTrendSummary

} from "../lib/events/eventScore";





async function refreshEventScore(){



console.log(
"🔥 开始刷新事件评分..."
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



let score =
calculateEventScore(
event.news
);

if(event.eventType==="trend"){
  score = Math.round(score * 0.35);
}



const trend =
calculateTrendStatus(
score
);



const summary =
generateTrendSummary(
score
);





await prisma.newsEvent.update({

where:{

id:event.id

},


data:{


heatScore:
score,


peakScore:
Math.max(
event.peakScore,
score
),


trendStatus:
trend,


trendSummary:
summary


}


});





console.log(

`✅ ${event.title}
热度:${score}
趋势:${trend}`

);


}





console.log(
"🎉 事件评分刷新完成"
);


}





refreshEventScore()

.catch(error=>{


console.error(
error
);


process.exit(1);


})

.finally(async()=>{


await prisma.$disconnect();


});