import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();



const sources = [


{
    name:"OpenAI 官方博客",

    url:"https://openai.com",

    rssUrl:"https://openai.com/news/rss.xml",

    type:"rss",

    status:"active",

    enabled:true,

    rssEnabled:true,

    rssWeight:100

},



{
    name:"Google AI Blog",

    url:"https://blog.google/technology/ai/",

    rssUrl:"https://blog.google/technology/ai/rss/",

    type:"rss",

    status:"active",

    enabled:true,

    rssEnabled:true,

    rssWeight:95

},



{
    name:"Microsoft AI Blog",

    url:"https://techcommunity.microsoft.com/category/azure-ai",

    rssUrl:"https://techcommunity.microsoft.com/rss/board?board.id=AzureAI",

    type:"rss",

    status:"active",

    enabled:true,

    rssEnabled:true,

    rssWeight:90

},



{
    name:"Anthropic News",

    url:"https://www.anthropic.com/news",

    rssUrl:null,

    type:"rss",

    status:"active",

    enabled:true,

    rssEnabled:false,

    rssWeight:85

},



{
    name:"百度智能云",

    url:"https://cloud.baidu.com/",

    rssUrl:null,

    type:"web",

    status:"active",

    enabled:true,

    rssEnabled:false,

    rssWeight:70

},



{
    name:"腾讯AI",

    url:"https://ai.qq.com/",

    rssUrl:null,

    type:"web",

    status:"active",

    enabled:true,

    rssEnabled:false,

    rssWeight:70

},



{
    name:"知乎AI话题",

    url:"https://www.zhihu.com/topic/19552832",

    rssUrl:null,

    type:"web",

    status:"active",

    enabled:true,

    rssEnabled:false,

    rssWeight:60

},



{
    name:"微博AI",

    url:"https://weibo.com",

    rssUrl:null,

    type:"web",

    status:"active",

    enabled:true,

    rssEnabled:false,

    rssWeight:60

}



];





async function main(){



    console.log(
        "开始导入RSS来源..."
    );



    for(const source of sources){



        await prisma.source.upsert({

            where:{
                name:source.name
            },


            update:{


                url:source.url,

                rssUrl:source.rssUrl,

                type:source.type,

                status:source.status,

                enabled:source.enabled,

                rssEnabled:source.rssEnabled,

                rssWeight:source.rssWeight


            },


            create:{


                name:source.name,

                url:source.url,

                rssUrl:source.rssUrl,

                type:source.type,

                status:source.status,

                enabled:source.enabled,

                rssEnabled:source.rssEnabled,

                rssWeight:source.rssWeight


            }


        });



        console.log(
            "完成:",
            source.name
        );


    }



}



main()

.then(()=>{


    console.log(
        "RSS来源导入完成"
    );


})


.catch(error=>{


    console.error(error);


})


.finally(async()=>{


    await prisma.$disconnect();


});