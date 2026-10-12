import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET() {

  try {

    const [
      newsCount,
      reportCount,
      eventCount,
      opportunityCount,
      investmentCount,
    ] = await Promise.all([

      prisma.news.count(),

      prisma.dailyReport.count(),

      prisma.newsEvent.count(),

      prisma.businessOpportunity.count(),

      prisma.investment.count(),

    ]);


    const latestNews =
      await prisma.news.findFirst({

        orderBy:{
          createdAt:"desc"
        },

        select:{
          createdAt:true
        }

      });


    const latestReport =
      await prisma.dailyReport.findFirst({

        orderBy:{
          createdAt:"desc"
        },

        select:{
          createdAt:true
        }

      });



    return NextResponse.json({

      success:true,


      system:{

        web:"online",

        database:"connected",

      },


      data:{

        newsCount,

        reportCount,

        eventCount,

        opportunityCount,

        investmentCount,


        latestNews:
          latestNews?.createdAt || null,


        latestReport:
          latestReport?.createdAt || null,

      }


    });



  } catch(error){


    console.error(
      "system health error:",
      error
    );


    return NextResponse.json({

      success:false,

      error:String(error)

    },{

      status:500

    });


  }

}
