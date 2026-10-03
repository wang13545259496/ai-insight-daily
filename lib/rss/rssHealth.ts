import Parser from "rss-parser";


const parser = new Parser();



function getErrorMessage(error:unknown):string{

  return error instanceof Error
    ? error.message
    : String(error);

}

export async function checkRSS(

  rssUrl:string

){


  if(!rssUrl){

    return {

      success:false,

      count:0,

      message:"RSS地址为空"

    };

  }



  try{


    const feed = await parser.parseURL(
      rssUrl
    );


    return {

      success:true,

      count:feed.items.length,

      message:"RSS正常"

    };


  }catch(error:unknown){


    return {

      success:false,

      count:0,

      message:
        getErrorMessage(error) || "RSS检测失败"

    };


  }


}