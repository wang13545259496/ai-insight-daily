import { prisma } from "@/lib/prisma";

/**
 * 多源融合（已停用）。
 *
 * ⚠️ 停用原因（2026-10，凭实测数据）：
 *
 * 原实现用「字符集重叠率」判断两篇新闻是否同一事件，阈值 0.65，
 * 命中后立即把另一条的来源名并入本条并写库。
 * 该算法对中文极不可靠——两篇毫无关系的新闻只要用字相近，
 * 相似度就会超过 0.65。
 *
 * 实测后果：库中 1078 条（占 82.29%）记录的 mergedSources 被标注为
 * 「OpenAI 官方博客,Google AI Blog」，而这些记录的 sourceUrl
 * 实际全部指向 openai.com。即绝大多数「多来源」标注是错的，
 * sourceCount / originalSourceCount / mergedSources 三个字段
 * 因此整体不可信。
 *
 * 另外该函数是独立脚本（npm run rss:fusion），在主流之外对已入库
 * 新闻再跑一遍，与入库逻辑互不知情，进一步放大了错配。
 *
 * 现在的做法：
 *   正确的多源合并发生在入库阶段（lib/news/ingest.ts）——
 *   只有 duplicateHash / sourceUrl / 归一化标题 三者之一命中时，
 *   才认定是同一篇文章并合并来源。那是确定性判据，
 *   不依赖模糊相似度。
 *
 * 因此本函数保留为空实现，避免误调用再次污染数据。
 * 若将来需要「疑似重复」提示，应使用 lib/news/dedup.ts 的
 * titleSimilarity，并把结果交给人工复核，不要自动写库。
 */
export async function mergeRSSNews(): Promise<{
  success: boolean;
  mergeCount: number;
  message: string;
}> {
  const total = await prisma.news.count();

  const message =
    "多源融合已停用：原按字符集相似度自动合并，实测造成 1078 条（82%）错误的来源标注。" +
    "正确的合并已移至入库阶段（lib/news/ingest.ts），按哈希 / URL / 归一化标题判定。";

  console.log("[fusion] " + message);
  console.log(`[fusion] 当前库中新闻 ${total} 条，本次未做任何修改`);

  return { success: true, mergeCount: 0, message };
}
