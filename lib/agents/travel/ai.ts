/**
 * 旅行规划的模型调用层。
 *
 * 与项目既有的 lib/ai-summary.ts 保持同一模式：
 *   - OpenAI SDK + DeepSeek 端点（DEEPSEEK_MODEL 控制模型）
 *   - response_format: { type: "json_object" } 强制结构化输出
 *   - 未配置密钥或调用失败时返回 null，由调用方降级到模板
 *
 * 这样业务代码不直接依赖具体模型，符合 AI_API_INTEGRATION.md
 * 「业务逻辑不依赖单一模型」的方向。
 */

import OpenAI from "openai";

import { recordUsage } from "@/lib/ai-summary";

const apiKey = process.env.DEEPSEEK_API_KEY;

let client = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    })
  : null;

/**
 * 仅供测试使用的客户端替换入口。
 *
 * 为什么不用 mock 框架：Node 的 mock.module 在部分版本上不可用
 * （实测本机报 `mock.module is not a function`），而 travelChat 只依赖
 * 这一个对象，显式注入比拦截模块解析更简单也更稳定。
 *
 * 生产代码不应调用它。
 */
export function __setTravelAIClientForTest(replacement: unknown): void {
  client = (replacement ?? null) as typeof client;
}

/** 是否已配置模型，调用方据此决定是否走模板兜底 */
export function isTravelAIEnabled(): boolean {
  return client !== null;
}

/** 当前模型名，用于在方案里如实标注由哪个模型生成 */
export function getTravelAIModel(): string {
  return process.env.DEEPSEEK_MODEL || "deepseek-chat";
}

export interface TravelChatOptions {
  system: string;
  user: string;
  /** 采样温度，默认 0.6 */
  temperature?: number;
  /** 最大输出 token，默认 8000（一份 5 天行程 JSON 约 4600 token） */
  maxTokens?: number;
}

/**
 * 调用模型生成行程 JSON。
 * 未配置密钥或两次尝试均失败时返回 null。
 *
 * 只负责「拿到文本」：JSON 解析与模板降级由 planner.ts 决定，
 * 保持这一层职责单一，也便于单独替换模型。
 */
export async function travelChat(options: TravelChatOptions): Promise<string | null> {
  if (!client) {
    return null;
  }

  const model = getTravelAIModel();

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxTokens ?? 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user },
        ],
      });

      /**
       * 记录 token 用量。
       *
       * 旅行生成是站内最贵的 AI 调用（max_tokens 8000，
       * 单次约 ¥0.02–0.03，是新闻摘要的 5–7 倍）。
       * 改造前完全不记录，账单涨了看不出是谁花的 ——
       * 加上之后 ai-usage.log 里能按时间对上是哪一次行程。
       *
       * 注意：这里记的是「一次模型调用」，不是「一份方案」。
       * 失败重试会调两次，因此可能出现方案数少于调用数的情况。
       */
      recordUsage(model, response.usage);

      const text = response.choices?.[0]?.message?.content?.trim();

      if (text) {
        return text;
      }

      console.warn("[travel] 模型返回空内容", { attempt, model });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error("[travel] 模型调用失败", { attempt, model, message });

      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }

  return null;
}
