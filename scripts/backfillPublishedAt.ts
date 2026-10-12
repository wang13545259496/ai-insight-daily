import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();


async function main(){

    const news =
    await prisma.news.findMany({

        where:{
            publishedAt:null
        },

        select:{
            id:true,
            createdAt:true
        }

    });


    console.log(
        "需要回填:",
        news.length
    );


    let count=0;


    for(const item of news){

        await prisma.news.update({

            where:{
                id:item.id
            },

            data:{
                publishedAt:
                item.createdAt
            }

        });


        count++;

    }


    console.log(
        "完成回填:",
        count
    );

}


main()
.finally(
()=>prisma.$disconnect()
);
