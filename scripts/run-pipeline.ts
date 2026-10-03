import {
    runNewsPipeline
}
from "@/lib/intelligence/newsPipeline";



async function main(){


    const result =
        await runNewsPipeline();



    console.log(
        "AI新闻流水线执行结果:",
        result
    );


}



main()
.catch(error=>{

    console.error(error);

    process.exit(1);

});