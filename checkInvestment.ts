import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


async function main(){

const data = await prisma.investment.findMany();

console.log(data);

}


main()
.finally(()=>prisma.$disconnect());