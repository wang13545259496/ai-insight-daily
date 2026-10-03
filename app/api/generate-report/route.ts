import { importNews } from "@/lib/news-import";
import { generateDailyReport } from "@/lib/report-generator";


export async function GET(){

  try{


    const imported =
      await importNews();



    const report =
      await generateDailyReport();



    return Response.json({

      success:true,

      imported,

      report

    });



  }catch(error){


    return Response.json({

      success:false,

      error:String(error)

    });


  }


}