import { prisma } from "../lib/prisma";


async function main(){

  await prisma.news.updateMany({

    data:{
      eventId:null
    }

  });


  await prisma.newsEvent.deleteMany();


  console.log(
    "热点事件已清理"
  );

}


main()
.finally(()=>prisma.$disconnect());