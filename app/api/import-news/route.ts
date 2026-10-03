import { importNews } from "@/lib/news-import";


export async function GET(){


  try{


    const result = await importNews();



    return Response.json({

      success:true,

      result

    });



  }catch(error){


    return Response.json({

      success:false,

      error:String(error)

    });


  }


}