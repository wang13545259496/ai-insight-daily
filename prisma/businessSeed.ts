import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();



async function main(){


console.log("开始导入AI商业机会数据...");



// 清理旧数据

await prisma.businessReport.deleteMany();

await prisma.businessOpportunity.deleteMany();





// ===============================
// AI商业机会1
// ===============================


await prisma.businessOpportunity.create({

data:{


industry:"AI办公",


opportunity:"企业智能助手",


trend:"高速增长",


direction:"企业服务",


description:
"利用AI Agent帮助企业完成办公自动化、知识管理和流程优化。",



BusinessReport:{


create:{


marketAnalysis:
"随着企业数字化升级，AI办公助手正在成为企业提高效率的重要工具。中小企业尤其需要低成本、高效率的智能办公方案。",



painPoints:
"企业员工每天处理大量重复工作，包括文档整理、信息查询、会议纪要和客户沟通。",



aiSolution:
"通过AI Agent连接企业知识库、办公软件和业务系统，实现自动化办公流程。",



productDesign:
"企业知识库助手、智能文档生成、会议总结、AI客服和流程自动化工具。",



businessModel:
"采用SaaS订阅模式，根据企业人数和功能模块收费。",



riskAnalysis:
"主要风险包括企业数据安全、模型准确性以及市场竞争压力。",



startupAdvice:
"建议从垂直行业切入，例如教育、物业、医疗、制造等领域，打造行业AI助手。"


}


}


}


});








// ===============================
// AI商业机会2
// ===============================


await prisma.businessOpportunity.create({

data:{


industry:"AI营销",


opportunity:"智能营销Agent",


trend:"快速增长",


direction:"企业增长",


description:
"利用AI自动完成市场分析、内容生成、客户运营和销售辅助。",


BusinessReport:{


create:{


marketAnalysis:
"企业营销数字化需求持续增加，AI营销工具降低企业获客成本。",



painPoints:
"企业缺少专业营销人员，内容生产效率低，客户转化困难。",



aiSolution:
"AI Agent自动分析客户数据，生成营销方案和销售策略。",



productDesign:
"AI文案生成、客户画像、自动投放优化、销售助手。",



businessModel:
"SaaS订阅+增值服务模式。",



riskAnalysis:
"数据质量和行业竞争是主要挑战。",



startupAdvice:
"选择细分行业打造AI营销解决方案，提高竞争壁垒。"


}


}


}


});









// ===============================
// AI商业机会3
// ===============================


await prisma.businessOpportunity.create({

data:{


industry:"AI教育",


opportunity:"AI学习助手",


trend:"持续增长",


direction:"教育科技",


description:
"利用AI提供个性化学习规划、答疑和知识辅导。",


BusinessReport:{


create:{


marketAnalysis:
"人工智能正在改变传统教育方式，个性化学习需求不断增加。",



painPoints:
"学生缺少个性化指导，教师工作压力较大。",



aiSolution:
"AI根据学习情况提供知识讲解和学习路径规划。",



productDesign:
"智能答疑、学习计划、知识图谱、AI老师。",



businessModel:
"会员订阅和教育机构合作。",



riskAnalysis:
"教育质量控制和内容准确性需要持续优化。",



startupAdvice:
"从细分学科或职业教育领域切入。"


}


}


}


});





console.log("AI商业机会数据导入完成！");


}




main()


.catch((error)=>{

console.error(error);

})


.finally(async()=>{

await prisma.$disconnect();

});