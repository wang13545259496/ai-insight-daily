import { prisma } from "@/lib/prisma";



export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id:string }>
  }
){


  const {id} =
    await context.params;



  await prisma.news.delete({

    where:{
      id:Number(id)
    }

  });



  return Response.json({

    success:true

  });


}




export async function PATCH(
  request: Request,
  context:{
    params:Promise<{id:string}>
  }
){


  const {id} =
    await context.params;



  const news =
    await prisma.news.update({

      where:{
        id:Number(id)
      },


      data:{

        verified:true

      }

    });



  return Response.json({

    success:true,

    news

  });


}