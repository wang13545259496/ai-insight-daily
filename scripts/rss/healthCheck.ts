import { prisma } from "@/lib/prisma";

import {
    calculateRSSWeight
}
from "@/lib/rss/rssWeight";



interface CheckResult {

    status:
    "healthy"
    |
    "warning"
    |
    "failed";

    score:number;

    responseTime:number;

    message:string;

}





function getErrorMessage(error:unknown):string{

  return error instanceof Error
    ? error.message
    : String(error);

}

async function checkRSS(
    url:string
):Promise<CheckResult>{


    const start =
    Date.now();



    try{


        const response =
        await fetch(
            url,
            {

                method:"GET",

                headers:{

                    "User-Agent":
                    "AI-Insight-Daily-RSS-Monitor"

                },


                signal:
                AbortSignal.timeout(
                    10000
                )

            }
        );



        const responseTime =
        Date.now()
        -
        start;




        if(!response.ok){


            return {

                status:"failed",

                score:30,

                responseTime,

                message:
                `HTTP ${response.status}`

            };


        }




        let score = 100;



        // 响应速度评分

        if(responseTime > 3000){

            score -= 20;

        }
        else if(responseTime > 1500){

            score -= 10;

        }



        return {


            status:
            score >= 80
            ?
            "healthy"
            :
            "warning",


            score,


            responseTime,


            message:
            "RSS正常"


        };



    }
    catch(error:unknown){

        const message = getErrorMessage(error);



        return {

            status:"failed",

            score:0,

            responseTime:
            Date.now()-start,


            message:
            message
            ||
            "连接失败"


        };


    }


}





async function main(){


console.log(
"开始RSS健康检测..."
);



const sources =
await prisma.source.findMany({

    where:{

        rssUrl:{
            not:null
        }

    }

});



let healthy = 0;

let warning = 0;

let failed = 0;




for(
const source of sources
){



    if(!source.rssUrl){

        continue;

    }




    const result =
    await checkRSS(
        source.rssUrl
    );





    let failCount =
    source.rssFailCount
    ||
    0;




    let successCount =
    source.rssSuccessCount
    ||
    0;



    let totalCount =
    source.rssTotalCount
    ||
    0;





    totalCount++;





    if(
        result.status==="failed"
    ){

        failCount++;

    }
    else{

        failCount=0;

        successCount++;

    }





    const successRate =
    Math.round(

        successCount
        /
        totalCount
        *
        100

    );





    const rssWeight =
    calculateRSSWeight({

        score:
        result.score,


        responseTime:
        result.responseTime,


        successRate,


        failCount

    });







    let rssEnabled =
    true;



    let rssPausedAt =
    null;





    // 连续失败3次自动暂停

    if(
        failCount >= 3
    ){

        rssEnabled=false;


        rssPausedAt =
        new Date();


    }







    // 恢复机制

    if(
        result.status==="healthy"
    ){

        rssEnabled=true;


        rssPausedAt=null;


    }







    await prisma.source.update({

        where:{

            id:
            source.id

        },


        data:{



            rssStatus:
            result.status,


            rssScore:
            result.score,


            rssFailCount:
            failCount,



            rssEnabled,


            rssWeight,



            rssSuccessCount:
            successCount,


            rssTotalCount:
            totalCount,



            rssPausedAt,



            lastCheckTime:
            new Date(),



            lastResponseTime:
            result.responseTime,



            lastError:
            result.status==="failed"
            ?
            result.message
            :
            null


        }


    });







    if(
        result.status==="healthy"
    ){

        healthy++;

    }


    else if(
        result.status==="warning"
    ){

        warning++;

    }


    else{


        failed++;

    }






    console.log(

        `[${result.status}]`,
        source.name,

        "评分:",
        result.score,

        "权重:",
        rssWeight,

        "响应:",
        result.responseTime+"ms"


    );





}





console.log("");

console.log(
"RSS检测完成"
);


console.log("");

console.log(
"健康:",
healthy
);


console.log(
"警告:",
warning
);


console.log(
"失败:",
failed
);



}





main()

.then(()=>{


    process.exit(0);


})


.catch(error=>{


    console.error(error);


    process.exit(1);


});