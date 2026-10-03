import { linkNewsEvents }
from "@/lib/intelligence/linkNewsEvent";


async function main(){


const result =
await linkNewsEvents();


console.log(
"新闻事件关联完成:",
result
);


}


main();