import {
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.investment.count();

  console.log(
    `Investment 数据库当前已有 ${count} 条记录。`
  );

  console.log(
    "已停止导入演示投资项目。"
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
