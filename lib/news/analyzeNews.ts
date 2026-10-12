import { prisma } from "@/lib/prisma";
import { generateSummary } from "@/lib/ai-summary";

interface AnalyzeInput {
  newsId: number;
}

export async function analyzeNews({ newsId }: AnalyzeInput) {

  const news = await prisma.news.findUnique({
    where:{
      id:newsId
    }
  });

  if(!news){
    return null;
  }


  const result = await generateSummary(
    news.title,
    news.content || news.summary || ""
  );


  const updated = await prisma.news.update({

    where:{
      id:newsId
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


  return updated;

}
