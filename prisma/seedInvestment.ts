import {
PrismaClient
}
from "@prisma/client";


const prisma =
new PrismaClient();



async function main(){



await prisma.investment.createMany({

data:[


{

name:"AI企业助手",

industry:"企业AI服务",

description:
"AI Agent帮助企业提升办公效率",


businessScore:87,

technologyScore:85,

marketScore:90,

growthScore:92,

riskScore:35

},



{

name:"AI智能客服",

industry:"AI客服",

description:
"大模型驱动智能客服系统",


businessScore:84,

technologyScore:80,

marketScore:85,

growthScore:86,

riskScore:42

}


]

});


}



main()
.then(()=>{

console.log(
"投资项目导入完成"
);

})
.finally(()=>{

prisma.$disconnect();

});