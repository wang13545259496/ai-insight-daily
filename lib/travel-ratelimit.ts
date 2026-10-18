/**
 * 旅行模块的生成频率限制。
 *
 * ## 为什么需要
 *
 * 一次行程规划要调模型生成完整行程 JSON（max_tokens 8000），
 * 单次成本约 ¥0.02–0.03，是新闻摘要的 5–7 倍。
 * 没有限制时，任何一个拿到码的人可以无限次生成，费用全部记在维护者账上。
 *
 * ## 为什么存在内存里
 *
 * 应用由 PM2 以单进程 fork 模式运行，内存计数就是全局计数。
 * 没有引入 Redis 或数据库表 —— 对「每小时几次」这个粒度，
 * 进程重启后重置预算完全可以接受，不值得增加一套存储。
 *
 * 代价要写清楚：**重启会清空计数**。所以它是防误用、防脚本刷的闸门，
 * 不是精确的计费系统。真正的成本监控靠 ai-usage.log。
 *
 * ## 维护者为什么不受限
 *
 * 这条限制的目的是「防止别人的使用变成不可控的账单」，
 * 维护者自己用多少都在预期内，加了反而是负担。
 */

/** 滑动窗口长度（毫秒）：1 小时 */
const WINDOW_MS = 60 * 60 * 1000;

/** 每个身份在窗口内允许的生成次数 */
export const DEFAULT_HOURLY_LIMIT = 5;

/** grantId → 最近若干次请求的时间戳（毫秒） */
const buckets = new Map<string, number[]>();

/** 一次检查的结果 */
export interface RateLimitResult {
  allowed: boolean;
  /** 距下一次可用的毫秒数；allowed 为 true 时为 0 */
  retryAfterMs: number;
  /** 当前窗口内已用次数 */
  used: number;
  /** 上限 */
  limit: number;
}

/**
 * 清理过期的历史记录。
 *
 * 不加清理的话，Map 会随不同 grantId 无限增长。
 * 每次检查时顺手清掉窗口外的记录即可，不需要定时任务。
 */
function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;

  return timestamps.filter((t) => t > cutoff);
}

/**
 * 检查并消耗一次配额。
 *
 * 注意这是「先检查后消耗」合一的操作 —— 调用方不需要再单独记录，
 * 被拒绝的请求不消耗配额。
 *
 * @param grantId 身份标识（维护者由调用方自行跳过，不传进来）
 */
export function consumeRateLimit(
  grantId: string,
  limit: number = DEFAULT_HOURLY_LIMIT,
): RateLimitResult {
  const now = Date.now();

  const history = prune(buckets.get(grantId) ?? [], now);

  if (history.length >= limit) {
    // 最早那次请求滑出窗口后即可再用
    const retryAfterMs = Math.max(0, history[0] + WINDOW_MS - now);

    buckets.set(grantId, history);

    return { allowed: false, retryAfterMs, used: history.length, limit };
  }

  history.push(now);
  buckets.set(grantId, history);

  return { allowed: true, retryAfterMs: 0, used: history.length, limit };
}

/**
 * 只查询不消耗。用于测试与调试。
 */
export function peekRateLimit(
  grantId: string,
  limit: number = DEFAULT_HOURLY_LIMIT,
): RateLimitResult {
  const now = Date.now();
  const history = prune(buckets.get(grantId) ?? [], now);

  if (history.length >= limit) {
    const retryAfterMs = Math.max(0, history[0] + WINDOW_MS - now);

    return { allowed: false, retryAfterMs, used: history.length, limit };
  }

  return { allowed: true, retryAfterMs: 0, used: history.length, limit };
}

/** 清空全部计数。仅测试用 */
export function resetRateLimits(): void {
  buckets.clear();
}

/** 把毫秒转成人类可读的等待时长，用于提示文案 */
export function formatRetryAfter(ms: number): string {
  const minutes = Math.ceil(ms / 60000);

  if (minutes <= 1) return "不到 1 分钟";

  return `约 ${minutes} 分钟`;
}
