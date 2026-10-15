/**
 * 受控并发工具。
 *
 * 为什么需要：新闻分析原有实现是逐条串行调用大模型
 * （lib/scheduler/newsPipeline.ts 的 for 循环），30 条 × 平均 6 秒
 * 需要约 180 秒。实测 DeepSeek 单条生成速度约 257 token/秒并不慢，
 * 慢在串行排队。
 *
 * 为什么不直接用 Promise.all 全量并行：模型接口对并发有隐性限制，
 * 一次性发出几十个请求容易触发限流。这里限制「同时在飞」的请求数，
 * 把总耗时从「条数 × 单条耗时」压到约「批数 × 单条耗时」，
 * 同时留出失败重试的余地。
 *
 * 本模块只做调度，不认识业务类型。
 */

/**
 * 受控并发地处理数组，结果顺序与输入一致。
 *
 * @param items    待处理项
 * @param limit    同时在飞的最大请求数
 * @param worker   处理函数；抛错时该项结果为 null
 * @param onSettle 每完成一项的回调（成功或失败都触发），用于进度上报
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onSettle?: (done: number, total: number, ok: boolean) => void,
): Promise<Array<R | null>> {
  const results: Array<R | null> = new Array(items.length).fill(null);

  if (items.length === 0) {
    return results;
  }

  const safeLimit = Math.max(1, Math.min(limit, items.length));

  let cursor = 0;
  let done = 0;

  const runners = Array.from({ length: safeLimit }, async () => {
    while (cursor < items.length) {
      const index = cursor++;

      try {
        results[index] = await worker(items[index], index);
        done++;
        onSettle?.(done, items.length, true);
      } catch (error) {
        // 单条失败不应中断整批：结果保持 null，由调用方决定如何处理
        console.error(`[concurrency] 第 ${index} 项失败:`, String(error).split("\n")[0]);
        done++;
        onSettle?.(done, items.length, false);
      }
    }
  });

  await Promise.all(runners);

  return results;
}
