import { buildNewsEvents } from "../lib/ai/eventCluster";


async function main() {

  console.log("开始构建AI热点事件...");


  const events = await buildNewsEvents();


  console.log(
    "热点事件生成完成:",
    events.length
  );


}


main()
.catch((error)=>{

  console.error(error);

  process.exit(1);

});