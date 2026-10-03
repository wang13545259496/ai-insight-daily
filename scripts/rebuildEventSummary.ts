import { prisma } from "@/lib/prisma"



async function rebuildEventSummary(){



console.log("开始重构AI事件摘要...")



const events =

await prisma.newsEvent.findMany({

include:{

news:true

}

})



console.log(

`发现 ${events.length} 个事件`

)





let count = 0



for(const event of events){



const news = event.news



if(news.length===0){

continue

}




// 来源统计

const sources =

Array.from(

new Set(

news

.map(item=>item.source)

.filter(Boolean)

)

)

.slice(0,5)





// 最新新闻时间

const latestNews =

news

.sort(

(a,b)=>

new Date(b.createdAt).getTime()

-

new Date(a.createdAt).getTime()

)[0]





const summary =

`

该事件当前关联：

${news.length} 篇相关新闻。


事件分类：

${event.category}


当前趋势：

${event.trendStatus}


当前热度：

${event.heatScore}


主要信息来源：

${sources.join("、") || "暂无"}


最新动态时间：

${latestNews?.createdAt.toISOString().slice(0,10) || "未知"}


系统根据：

新闻聚合、

多源来源分析、

事件热度变化

自动生成该事件摘要。


`





await prisma.newsEvent.update({

where:{

id:event.id

},

data:{

summary

}

})



count++



console.log(

`完成 ${count}/${events.length}: ${event.title}`

)



}



console.log(

"AI事件摘要重构完成"

)



}



rebuildEventSummary()

.catch((error)=>{

console.error(error)

process.exit(1)

})

.finally(async()=>{

await prisma.$disconnect()

})