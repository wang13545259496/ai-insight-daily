import { prisma } from "@/lib/prisma";


export async function POST(request: Request) {


  const body = await request.json();


  const news = await prisma.news.create({

    data: {

      title: body.title,

      category: body.category,

      background: body.background,

      summary: body.summary,

      content: body.content,

      source: body.source,

      sourceUrl: body.sourceUrl || "",

      verified: true

    }

  });


  return Response.json({

    success:true,

    data:news

  });


}