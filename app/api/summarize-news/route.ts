import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/ai-summary";


export async function GET(){


  const news =
  await prisma.news.findMany({

    take:5,

    orderBy:{
      createdAt:"desc"
    }

  });



  let updated=0;



  for(const item of news){


    const result =
    await generateSummary(
      item.title,
      item.content
    );



    await prisma.news.update({

      where:{
        id:item.id
      },


      data:{


        background:
        result.background,


        summary:
        result.summary,


        content:
        result.content


      }


    });


    updated++;


  }



  return Response.json({

    success:true,

    updated

  });


}