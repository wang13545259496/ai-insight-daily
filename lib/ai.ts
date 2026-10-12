import { generateSummary as generateNewsSummary } from "@/lib/ai-summary";

export async function generateSummary(content: string) {
  const result = await generateNewsSummary(
    content,
    content
  );

  return `背景：
${result.background}

内容：
${result.summary}

影响：
${result.impact}

来源分析：
${result.insight}`;
}
