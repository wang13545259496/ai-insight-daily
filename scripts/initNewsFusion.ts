import { prisma } from "@/lib/prisma";



function normalize(text:string){

    return text
        .toLowerCase()
        .replace(/\s+/g,"")
        .replace(/[^\u4e00-\u9fa5a-z0-9]/g,"");

}




function similarity(
    a:string,
    b:string
){

    const aSet =
        new Set(a);


    const bSet =
        new Set(b);



    const intersection =
        [...aSet]
        .filter(
            x=>bSet.has(x)
        )
        .length;



    const union =
        new Set([
            ...aSet,
            ...bSet
        ]).size;



    if(union===0){

        return 0;

    }


    return intersection / union;

}





async function main(){


    console.log(
        "开始RSS多源融合初始化..."
    );



    const news =
        await prisma.news.findMany({

            orderBy:{
                createdAt:"desc"
            },


            include:{
  sourceRef:true
}

        });



    console.log(
        "新闻数量:",
        news.length
    );



    let mergeCount=0;



    for(
        let i=0;
        i<news.length;
        i++
    ){



        const current =
            news[i];



        const currentTitle =
            normalize(
                current.title
            );



        const sources =
            new Set<string>();



        if(
            current.sourceRef
        ){

            sources.add(
                current.sourceRef?.name
            );

        }else{

            sources.add(
                current.source
            );

        }





        for(
            let j=0;
            j<news.length;
            j++
        ){


            if(i===j){

                continue;

            }



            const target =
                news[j];



            const targetTitle =
                normalize(
                    target.title
                );



            const score =
                similarity(
                    currentTitle,
                    targetTitle
                );



            if(
                score >=0.65
            ){


                if(
                    target.sourceRef
                ){

                    sources.add(
                        target.sourceRef?.name
                    );

                }



            }



        }





        if(
            sources.size>1
        ){



            await prisma.news.update({

                where:{
                    id:current.id
                },


                data:{


                    sourceCount:
                        sources.size,


                    originalSourceCount:
                        sources.size,


                    mergedSources:
                        Array.from(
                            sources
                        ).join(",")


                }

            });



            mergeCount++;


        }



    }




    console.log(
        "融合事件数量:",
        mergeCount
    );



}



main()

.catch(console.error)

.finally(async()=>{

    await prisma.$disconnect();

});