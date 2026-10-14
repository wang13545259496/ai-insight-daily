/**
 * 全量试跑：抓取 16 个源 → 完整处理（含正文补全）→ 打印统计。
 * **不写库。**
 *
 * 重点验证两件事：
 *   1. 16 个源是否都能采到数据（阶段 1 的核心目标）
 *   2. 正文补全的耗时（每条一次网络请求，可能很慢）
 */
import { fetchRSSNewsDetailed } from "@/lib/rss";
import { cleanContent, isBadContent } from "@/lib/news/contentCleaner";
import { checkContentQuality } from "@/lib/news/contentQualityScore";
import { classifyNewsType } from "@/lib/news/newsTypeClassifier";
import { extractArticleBody } from "@/lib/news/articleBody";

const MIN_CONTENT_LENGTH = 40;

/** 需要补正文的源（与 ingest.ts 保持一致） */
const BODY_FETCH_SOURCES = new Set(["量子位", "InfoQ 中文"]);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchBody(url: string): Promise<string | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: c.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" },
    });

    if (!res.ok) return null;

    return extractArticleBody(await res.text(), url);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const t0 = Date.now();

  console.log("开始抓取全部启用源...\n");

  const fetched = await fetchRSSNewsDetailed();

  const tFetch = Date.now() - t0;

  console.log("\n" + "=".repeat(74));
  console.log("【抓取阶段】");
  console.log(`  耗时 ${(tFetch / 1000).toFixed(1)} 秒`);
  console.log(`  源 ${fetched.sources.length} 个｜条目 ${fetched.items.length} 条\n`);

  console.log("按源统计：");
  console.log("  源".padEnd(24) + "条数".padStart(6) + "  状态");
  console.log("  " + "-".repeat(50));

  for (const s of fetched.sources) {
    const mark = s.error ? "✗ " + s.error.slice(0, 40) : "✓";
    console.log("  " + s.name.padEnd(22) + String(s.count).padStart(6) + "  " + mark);
  }

  const failed = fetched.sources.filter((s) => s.error);
  const okSources = fetched.sources.filter((s) => !s.error && s.count > 0);

  console.log("\n  " + "-".repeat(50));
  console.log(`  成功采集的源：${okSources.length} / ${fetched.sources.length}`);
  if (failed.length > 0) {
    console.log(`  失败的源：${failed.map((s) => s.name).join("、")}`);
  }

  // ---------- 处理阶段 ----------
  console.log("\n" + "=".repeat(74));
  console.log("【处理阶段】");

  const t1 = Date.now();

  // 需要补正文的条目
  const needBody = fetched.items.filter(
    (i) =>
      BODY_FETCH_SOURCES.has(i.sourceName) &&
      Boolean(i.sourceUrl) &&
      String(i.content || i.summary || "").length < MIN_CONTENT_LENGTH,
  );

  console.log(`  需补正文 ${needBody.length} 条（每条约 1 次网络请求）`);

  const bodies = new Map<string, string>();

  // 受控并发 3
  let cursor = 0;
  const workers = Array.from({ length: Math.min(3, needBody.length) }, async () => {
    while (cursor < needBody.length) {
      const item = needBody[cursor++];
      const body = await fetchBody(String(item.sourceUrl));

      if (body) bodies.set(String(item.sourceUrl), body);
    }
  });

  await Promise.all(workers);

  const tBody = Date.now() - t1;

  console.log(`  补全成功 ${bodies.size} / ${needBody.length} 条，耗时 ${(tBody / 1000).toFixed(1)} 秒`);

  // 逐条判定
  let ready = 0;
  let short = 0;
  let bad = 0;
  let notNews = 0;
  let repair = 0;

  const bySourceReady = new Map<string, number>();

  for (const item of fetched.items) {
    const body = item.sourceUrl ? bodies.get(item.sourceUrl) : undefined;
    const effective = body || String(item.content || item.summary || "");
    const cleaned = cleanContent(effective);

    if (cleaned.length < MIN_CONTENT_LENGTH) {
      short++;
      continue;
    }

    if (isBadContent(cleaned)) {
      bad++;
      continue;
    }

    const type = classifyNewsType(item.title, cleaned);

    if (type.type !== "news" && type.score >= 50) {
      notNews++;
      continue;
    }

    const q = checkContentQuality(cleaned);

    if (q.level === "polluted") {
      repair++;
    } else {
      ready++;
      bySourceReady.set(item.sourceName, (bySourceReady.get(item.sourceName) || 0) + 1);
    }
  }

  console.log("\n  处理结果：");
  console.log(`    ✓ 可入库      ${ready}`);
  console.log(`    △ 标 repair   ${repair}`);
  console.log(`    ✗ 正文过短    ${short}`);
  console.log(`    ✗ 污染        ${bad}`);
  console.log(`    ✗ 非新闻      ${notNews}`);

  console.log("\n  各源可入库条数：");
  const sorted = [...bySourceReady.entries()].sort((a, b) => b[1] - a[1]);

  for (const [name, count] of sorted) {
    console.log("    " + name.padEnd(24) + String(count).padStart(4) + " 条");
  }

  const total = Date.now() - t0;

  console.log("\n" + "=".repeat(74));
  console.log(`总耗时 ${(total / 1000).toFixed(1)} 秒（抓取 ${(tFetch / 1000).toFixed(1)}s + 正文 ${(tBody / 1000).toFixed(1)}s）`);
  console.log(`单源占比：最高的源 ${sorted[0]?.[0]} 占 ${((sorted[0]?.[1] || 0) / Math.max(1, ready) * 100).toFixed(1)}%`);
  console.log("\n完成（未写库）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
