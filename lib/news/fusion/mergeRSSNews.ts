import { prisma } from "@/lib/prisma";


function normalize(text:string){

    return text
        .toLowerCase()
        .replace(/\s+/g,"")
        .replace(/[^\u4e00-\u9fa5a-z0-9]/g,"");

}



function calcSimilarity(
    a:string,
    b:string
){

    const aChars =
        new Set(a);


    const bChars =
        new Set(b);


    const same =
        [...aChars]
        .filter(
            x=>bChars.has(x)
        )
        .length;


    const total =
        new Set([
            ...aChars,
            ...bChars
        ]).size;


    if(!total){

        return 0;

    }


    return same / total;

}





export async function mergeRSSNews(){


    console.log(
        "开始新闻多源融合..."
    );


    const news =
        await prisma.news.findMany({

            orderBy:{
                createdAt:"desc"
            },

            take:200,

           include:{
  sourceRef:true
}

        });





    let mergeCount=0;



    for(
        let i=0;
        i<news.length;
        i++
    ){


        const current =
            news[i];



        const titleA =
            normalize(
                current.title
            );



        if(!titleA){

            continue;

        }




        for(
            let j=i+1;
            j<news.length;
            j++
        ){


            const target =
                news[j];



            const titleB =
                normalize(
                    target.title
                );



            const score =
                calcSimilarity(
                    titleA,
                    titleB
                );



            if(score < 0.65){

                continue;

            }





            const sources =
                new Set<string>();


            if(
                current.mergedSources
            ){

                current
                .mergedSources
                .split(",")
                .forEach(
                    x=>sources.add(x)
                );

            }



            if(
                target.sourceRef
            ){

                sources.add(
                    target.sourceRef?.name
                );

            }





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
        "融合完成:",
        mergeCount
    );


}