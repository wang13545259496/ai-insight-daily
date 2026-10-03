export async function generateSummary(
  title: string,
  content: string
) {


  return {


    background:
      `随着人工智能技术快速发展，${title} 受到行业关注，相关技术和应用正在持续推进。`,


    summary:
      `${title}成为近期AI领域的重要动态。`,


    content:
      `
新闻标题：

${title}


核心内容：

${content}


该事件反映了当前人工智能行业的发展趋势，
包括模型能力提升、企业应用落地以及技术生态竞争。
      `


  };


}