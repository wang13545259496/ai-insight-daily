import { buildEventClusters } from "@/lib/intelligence/eventCluster";


async function main() {


  const result =
    await buildEventClusters();


  console.log(
    "AI事件聚类完成:",
    result
  );


}



main()
  .catch((error)=>{

    console.error(error);

    process.exit(1);

  });