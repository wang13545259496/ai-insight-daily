import { PrismaClient } from "@prisma/client";
import { news } from "../data/news";


const prisma = new PrismaClient();


async function main() {


  await prisma.news.deleteMany();


  await prisma.news.createMany({

  data: news.map(item => ({

    title: item.title,

    category: item.tag,

    background: item.background ?? null,

    summary: item.content ?? "",

    content: item.content ?? "",

    source: item.source,

    sourceUrl: null,

    verified: true

  }))

});


  console.log("新闻数据导入完成");


}


main()
  .then(async()=>{

    await prisma.$disconnect();

  })

  .catch(async(e)=>{

    console.error(e);

    await prisma.$disconnect();

    process.exit(1);

  });