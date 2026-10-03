import {
runRSSScheduler
}
from "@/lib/rss/scheduler/rssScheduler";



runRSSScheduler()
.then(()=>{

console.log(
"执行完成"
);

process.exit(0);

})
.catch(error=>{

console.error(error);

process.exit(1);

});