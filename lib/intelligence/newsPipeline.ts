import { buildEventClusters } 
from "@/lib/intelligence/eventCluster";


import { linkNewsEvents }
from "@/lib/intelligence/linkNewsEvent";



export async function runNewsPipeline(){



    console.log(
        "开始执行AI新闻智能流水线..."
    );



    const clusterResult =
        await buildEventClusters();



    console.log(
        "事件聚类完成:",
        clusterResult
    );



    const linkResult =
        await linkNewsEvents();



    console.log(
        "新闻关联完成:",
        linkResult
    );



    return {


        cluster:
            clusterResult,


        link:
            linkResult


    };


}