import { prisma } from "@/lib/prisma";


function checkBadContent(text:string){

    if(!text){
        return "empty";
    }


    if(text.length < 80){
        return "too_short";
    }


    const badWords = [
        "关于我们",
        "加入我们",
        "联系我们",
        "投资者关系",
        "京ICP备",
        "版权所有",
        "客服热线",
        "dataLayer",
        "window.",
    ];


    for(const word of badWords){

        if(text.includes(word)){
            return "polluted";
        }

    }


    return null;

}



async function main(){

    console.log("开始新闻质量扫描...");


    const news =
        await prisma.news.findMany({

            select:{
                id:true,
                title:true,
                content:true,
                source:true
            }

        });



    let normal=0;
    let empty=0;
    let short=0;
    let polluted=0;


    const shortSamples:any[]=[];
    const pollutedSamples:any[]=[];



    for(const item of news){

        const result =
            checkBadContent(
                item.content || ""
            );


        if(!result){

            normal++;

        }
        else if(result==="empty"){

            empty++;

        }
        else if(result==="too_short"){

            short++;

            if(shortSamples.length<5){
                shortSamples.push({
                    id:item.id,
                    title:item.title
                });
            }

        }
        else{

            polluted++;

            if(pollutedSamples.length<5){
                pollutedSamples.push({
                    id:item.id,
                    title:item.title
                });
            }

        }

    }



    console.log({

        total:news.length,
        normal,
        empty,
        short,
        polluted

    });



    console.log(
        "短文本样本:"
    );

    console.log(shortSamples);



    console.log(
        "污染样本:"
    );

    console.log(pollutedSamples);



    await prisma.$disconnect();

}


main();
