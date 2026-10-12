import { prisma } from "@/lib/prisma";


function checkCompleteness(item:any){

    let score = 0;

    const reasons:string[] = [];


    if(item.content && item.content.length > 200){
        score += 20;
    }else{
        reasons.push("content_short");
    }


    if(item.summary){
        score += 15;
    }else{
        reasons.push("no_summary");
    }


    if(item.background){
        score += 15;
    }else{
        reasons.push("no_background");
    }


    if(item.impact){
        score += 20;
    }else{
        reasons.push("no_impact");
    }


    if(item.businessOpportunity){
        score += 20;
    }else{
        reasons.push("no_business");
    }


    if(item.sourceUrl){
        score += 10;
    }else{
        reasons.push("no_source_url");
    }


    let level =
        "normal";


    if(score < 40){
        level = "repair";
    }
    else if(score < 70){
        level = "warning";
    }


    return {
        score,
        level,
        reasons
    };

}



async function main(){


    console.log(
        "开始新闻完整度扫描..."
    );


    const news =
        await prisma.news.findMany({

            where:{
                dataStatus:"active"
            },

            select:{
                id:true,
                title:true,
                content:true,
                summary:true,
                background:true,
                impact:true,
                businessOpportunity:true,
                sourceUrl:true
            }

        });



    let normal = 0;
    let warning = 0;
    let repair = 0;


    const samples:any[] = [];


    for(const item of news){


        const result =
            checkCompleteness(item);



        if(result.level==="normal"){

            normal++;

        }
        else if(result.level==="warning"){

            warning++;

        }
        else{

            repair++;

        }


        if(result.level!=="normal" && samples.length<20){

            samples.push({

                id:item.id,
                title:item.title,
                score:result.score,
                reasons:result.reasons

            });

        }

    }



    console.log({

        total:news.length,

        normal,

        warning,

        repair

    });



    console.log(
        "问题样本:"
    );


    console.log(
        JSON.stringify(
            samples,
            null,
            2
        )
    );


    await prisma.$disconnect();

}


main();
