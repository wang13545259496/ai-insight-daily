import axios from "axios";


async function run(){


  try{


    const result =
      await axios.get(
        "http://localhost:3000/api/cron/daily"
      );


    console.log(
      result.data
    );


  }catch(error){


    console.error(
      "日报任务失败",
      error
    );


  }


}


run();