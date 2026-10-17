/**
 * 用 Node.js 测量真实访客体验。
 *
 * 为什么不用 curl：
 *   curl 默认按顺序尝试地址（先 IPv6 等满超时再试 IPv4），
 *   不做 Happy Eyeballs，所以会得出比浏览器差得多的结论。
 *
 *   Node 20+ 默认开启 autoSelectFamily，实现了 RFC 8305
 *   Happy Eyeballs v2 —— 与 Chrome / Safari / Firefox 行为一致。
 *
 * 本脚本对比两种情形的成功率与耗时，判断真实影响。
 */

const TARGET = "https://aibiliai.com/";
const N = 20;

async function bench(label, family) {
  const times = [];
  let fail = 0;
  const failMsgs = [];

  for (let i = 0; i < N; i++) {
    const t0 = performance.now();

    try {
      // Node 18+ 的 fetch（undici）。family 选项通过 Agent 传入。
      const { Agent, setGlobalDispatcher } = await import("undici");

      setGlobalDispatcher(
        new Agent({
          keepAlive: false,
          connect: family ? { family } : {},
        })
      );

      const res = await fetch(TARGET, { signal: AbortSignal.timeout(15000) });
      await res.text();

      if (res.status !== 200) {
        fail++;
        failMsgs.push(`HTTP ${res.status}`);
      } else {
        times.push(performance.now() - t0);
      }
    } catch (e) {
      fail++;
      failMsgs.push(String(e.message || e).slice(0, 60));
    }
  }

  const ok = times.length;
  const avg = ok ? times.reduce((a, b) => a + b, 0) / ok : 0;
  const slow = times.filter((t) => t > 2000).length;

  console.log(`  ${label}`);
  console.log(`    成功 ${ok}/${N}   失败 ${fail}`);
  if (ok) {
    console.log(
      `    耗时 平均 ${(avg / 1000).toFixed(2)}s  最快 ${(Math.min(...times) / 1000).toFixed(2)}s  最慢 ${(Math.max(...times) / 1000).toFixed(2)}s`
    );
    console.log(`    超过 2 秒: ${slow} / ${ok}`);
  }
  if (failMsgs.length) {
    console.log(`    失败原因（去重）: ${[...new Set(failMsgs)].slice(0, 3).join(" | ")}`);
  }
  console.log("");

  return { ok, fail, avg };
}

async function main() {
  console.log("=".repeat(62));
  console.log("真实访客体验测量（Node.js，含 Happy Eyeballs）");
  console.log("=".repeat(62));
  console.log("");
  console.log(`  目标: ${TARGET}`);
  console.log(`  次数: ${N}`);
  console.log(`  Node: ${process.version}`);
  console.log("");

  const r1 = await bench("① 默认（同时有 IPv4/IPv6，模拟浏览器）", null);
  const r2 = await bench("② 强制 IPv4（对照）", 4);

  console.log("=".repeat(62));
  console.log("结论");
  console.log("=".repeat(62));
  console.log("");

  if (r1.fail === 0 && r2.fail === 0) {
    console.log("  两种方式都 0 失败 —— 浏览器会正常回退到 IPv4，");
    console.log("  IPv6 不可达只带来少量延迟，不会导致打不开。");
  } else if (r1.fail > r2.fail) {
    console.log(`  默认失败 ${r1.fail} 次，强制 IPv4 失败 ${r2.fail} 次。`);
    console.log("  → IPv6 确实影响真实访问。");
  } else {
    console.log("  两种方式表现接近，IPv6 不是主要瓶颈。");
  }

  if (r1.avg > r2.avg * 1.5 && r1.ok > 0 && r2.ok > 0) {
    console.log(
      `  → 但平均耗时差 ${(r1.avg / r2.avg).toFixed(1)} 倍（${(r1.avg / 1000).toFixed(2)}s vs ${(r2.avg / 1000).toFixed(2)}s），` +
        "\n    IPv6 失败重试在拖慢首次加载。"
    );
  }
}

main().catch((e) => {
  console.error("失败:", e);
  process.exit(1);
});
