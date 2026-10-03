import { generateSummary } from "@/lib/ai";


export async function GET(){


  const result =
    await generateSummary(
      "OpenAI发布新的人工智能模型，提高模型推理能力，并推动更多AI应用发展。"
    );


  return Response.json({

    success:true,

    result

  });


}