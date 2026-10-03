import { prisma } from "@/lib/prisma";


export async function GET() {


  const sources = await prisma.source.findMany({

    where:{
      enabled:true
    }

  });


  return Response.json({

    success:true,

    message:"新闻采集任务启动",

    sources

  });


}