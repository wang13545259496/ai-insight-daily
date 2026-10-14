import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/ai-summary";

async function main(){

  const list = await prisma.news.findMany({
    where:{
      insight:{
        contains:"建议持续关注该事件后续技术进展"
      }
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
