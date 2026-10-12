import { prisma } from "@/lib/prisma";


function calculatePollutionScore(text:string,title:string){


    let score = 0;


    const highRisk = [

        "window.",
        "dataLayer",
        "gtag(",
        "__next_s",
        "requestAnimationFrame"

    ];


    const navWords = [

        "关于我们",
        "加入我们",
        "联系我们",
        "合作咨询",
        "商业生态",
        "查看全部",
        "投资者关系",
        "产品",
        "研究",
        "下载",
        "API平台",
        "文档"

    ];


    const copyrightWords = [

        "京ICP备",
        "版权所有",
        "Copyright",
        "客服热线",
        "意见反馈"

    ];



    for(const word of highRisk){

        if(text.includes(word)){
            score += 5;
        }

    }



    for(const word of navWords){

        if(text.includes(word)){
            score += 1;
        }

    }



    for(const word of copyrightWords){

        if(text.includes(word)){
            score += 3;
        }

    }



    // 标题像公司官网名称
    if(
        title.length < 30 &&
        text.length > 500
    ){

        score += 2;

    }



    return score;

}




async function main(){


    console.log(
        "开始升级版新闻污染清理..."
    );


    const news =
        await prisma.news.findMany({

            select:{
                id:true,
                title:true,
                content:true,
                source:true
            }

        });



    let cleaned = 0;


    const samples:any[]=[];



    for(const item of news){


        const score =
            calculatePollutionScore(
                item.content || "",
                item.title
            );



        if(score >= 5){


            await prisma.news.update({

                where:{
                    id:item.id
                },


                data:{


                    dataStatus:
                        "inactive",


                    cleanReason:
                        `官网污染评分:${score}`


                }


            });



            cleaned++;


            if(samples.length < 10){

                samples.push({

                    id:item.id,
                    title:item.title,
                    score

                });

            }


        }


    }



    console.log({

        cleaned,
        samples

    });



    await prisma.$disconnect();

}


main();
