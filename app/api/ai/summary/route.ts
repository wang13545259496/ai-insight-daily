import OpenAI from "openai";


const hasKey = !!process.env.OPENAI_API_KEY;


const client = hasKey
? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
: null;


export async function POST(request: Request) {


  try {


    const body = await request.json();


    const { title, content } = body;
    if(!client){

 return Response.json({

  success:true,

  data:{
    summary:`
背景：
${title}

内容：
${content}

来源：
AI Insight Daily 自动分析系统
`
  }

 });

}



    const response = await client.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[

        {
          role:"system",
          content:
          "你是一名专业AI新闻分析师，请按照时间、背景、内容、来源渠道整理新闻。"
        },

        {
          role:"user",
          content:`
标题：
${title}

正文：
${content}

请生成结构化摘要。
`
        }

      ]

    });



    return Response.json({

      success:true,

      data:{

        summary:
        response.choices[0].message.content

      }

    });



  } catch(error){


    console.error(error);


    return Response.json({

      success:false,

      error:String(error)

    },{

      status:500

    });


  }


}