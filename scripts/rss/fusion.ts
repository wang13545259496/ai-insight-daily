import { mergeRSSNews } from "@/lib/news/fusion/mergeRSSNews";


async function main(){


    console.log(
        "开始RSS新闻融合..."
    );


    await mergeRSSNews();


    console.log(
        "RSS新闻融合完成"
    );


}


main();