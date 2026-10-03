import { prisma } from "@/lib/prisma";
import crypto from "crypto";


function createHash(text:string){

    return crypto
        .createHash("md5")
        .update(
            text
                .toLowerCase()
                .replace(/\s+/g,"")
        )
        .digest("hex");

}



async function main(){


    console.log(
        "开始重建新闻Hash..."
    );



    const news =
        await prisma.news.findMany({

            include:{
  sourceRef:true
}

        });



    console.log(
        "发现新闻:",
        news.length
    );



    let count = 0;



    for(
        const item of news
    ){



        const duplicateHash =
            createHash(
                item.title
            );



        await prisma.news.update({

            where:{

                id:item.id

            },


            data:{


                duplicateHash,



                mergedSources:
                    item.sourceRef?.name ||
                    item.source ||
                    "未知",



                source:
                    item.sourceRef?.name ||
                    item.source



            }

        });



        count++;



    }




    console.log(
        "Hash重建完成:",
        count
    );



}



main()

.catch((error)=>{

    console.error(error);

})

.finally(async()=>{

    await prisma.$disconnect();

});