import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/ai-summary";

async function main(){

  const list = await prisma.news.findMany({
    where:{
      OR:[
        {
          impact:
            "该事件对AI产业的具体影响需要结合技术进展、应用场景和市场反馈进一步判断。"
        },
        {
          businessOpportunity:
            "该事件潜在商业价值需要结合产品落地、用户需求和产业链变化进一步评估。"
        },
        {
          investmentView:
            "该事件的投资价值需要结合产业竞争格局、企业优势和长期商业化能力综合判断。"
        }
      ]
    }
  });

  console.log("发现模板数据:", list.length);

  let done=0;

  for(const news of list){

    try{

      console.log("修复:", news.id, news.title);

      const result = await generateSummary(
        news.title,
        news.content || news.summary || ""
      );

      await prisma.news.update({
        where:{
          id:news.id
        },
        data:{
          background: result.background,
          summary: result.summary,
          content: result.content,
          insight: result.insight,
          impact: result.impact,
          businessOpportunity: result.businessOpportunity,
          investmentView: result.investmentView,
          aiScore: result.aiScore,
          analysisStatus:"completed"
        }
      });

      done++;

    }catch(e){
      console.error("失败:",news.id,e);
    }

  }

  console.log("修复完成:",done);

}

main()
.finally(()=>prisma.$disconnect());
