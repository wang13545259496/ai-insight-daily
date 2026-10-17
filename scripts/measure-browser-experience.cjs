/**
 * 测量真实访客体验（Node.js 内置 https 模块）。
 *
 * 关键点：Node 20+ 默认 autoSelectFamily=true，实现 RFC 8305
 * Happy Eyeballs v2 —— 与浏览器一致：先试 IPv6，250ms 后同时试 IPv4，
 * 谁先连上就用谁。
 *
 * 对比：
 *   ① autoSelectFamily=true   模拟浏览器
 *   ② family=4                强制 IPv4（对照基线）
 */

const https = require("node:https");
const dns = require("node:dns");

const HOSTNAME = "aibiliai.com";
const N = 20;

function fetchOnce(family) {
  return new Promise((resolve) => {
    const t0 = performance.now();

    const options = {
      hostname: HOSTNAME,
      path: "/",
      method: "GET",
      headers: { "User-Agent": "dsh-measure/1.0" },
      timeout: 15000,
    };

    if (family === 4) {
      // 强制 IPv4：关闭自动选择，只解析 A 记录
      options.family = 4;
      options.autoSelectFamily = false;
      options.lookup = (host, _opts, cb) => {
        dns.lookup(host, { family: 4 }, cb);
      };
    } else {
      // 浏览器行为：允许自动在 v4/v6 之间选择
      options.autoSelectFamily = true;
      options.autoSelectFamilyAttemptTimeout = 250;
    }

    const req = https.request(options, (res) => {
      let bytes = 0;
      res.on("data", (c) => {
        bytes += c.length;
      });
      res.on("end", () => {
        resolve({
          ok: res.statusCode === 200 && bytes > 0,
          ms: performance.now() - t0,
          status: res.statusCode,
        });
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, ms: performance.now() - t0, status: "TIMEOUT" });
    });

    req.on("error", (e) => {
      resolve({ ok: false, ms: performance.now() - t0, status: e.code || "ERR" });
    });

    req.end();
  });
}

async function bench(label, family) {
  const times = [];
  const fails = [];

  for (let i = 0; i < N; i++) {
    const r = await fetchOnce(family);
    if (r.ok) {
      times.push(r.ms);
      process.stdout.write(".");
    } else {
      fails.push(r.status);
      process.stdout.write("x");
    }
  }

  console.log("");
  const ok = times.length;
  const avg = ok ? times.reduce((a, b) => a + b, 0) / ok : 0;
  const slow = times.filter((t) => t > 2000).length;

  console.log(`  ${label}`);
  console.log(`    成功 ${ok}/${N}   失败 ${N - ok}`);
  if (ok) {
    console.log(
      `    平均 ${(avg / 1000).toFixed(2)}s  最快 ${(Math.min(...times) / 1000).toFixed(2)}s  最慢 ${(Math.max(...times) / 1000).toFixed(2)}s`
    );
    console.log(`    超过 2 秒: ${slow} / ${ok}`);
  }
  if (fails.length) {
    console.log(`    失败类型: ${[...new Set(fails)].join(", ")}`);
  }
  console.log("");

  return { ok, fail: N - ok, avg };
}

(async () => {
  console.log("=".repeat(62));
  console.log("真实访客体验测量（Node.js，含 Happy Eyeballs）");
  console.log("=".repeat(62));
  console.log("");
  console.log(`  目标: https://${HOSTNAME}/`);
  console.log(`  次数: ${N}`);
  console.log(`  Node: ${process.version}`);
  console.log(`  默认解析顺序: ${dns.getDefaultResultOrder()}`);
  console.log("");

  const r1 = await bench("① 浏览器行为（autoSelectFamily，IPv4+IPv6 并行）", null);
  const r2 = await bench("② 强制 IPv4（对照基线）", 4);

  console.log("=".repeat(62));
  console.log("结论");
  console.log("=".repeat(62));
  console.log("");

  if (r1.fail === 0 && r2.fail === 0) {
    console.log("  两种方式 0 失败。IPv6 不可达时浏览器会回退，不影响打开。");
  } else if (r1.fail > r2.fail) {
    console.log(`  默认失败 ${r1.fail} 次，IPv4 失败 ${r2.fail} 次 → IPv6 确实影响访问。`);
  } else {
    console.log("  两者表现接近。");
  }

  if (r1.ok && r2.ok && r1.avg > r2.avg * 1.3) {
    console.log(
      `  平均耗时 ${(r1.avg / 1000).toFixed(2)}s vs ${(r2.avg / 1000).toFixed(2)}s，` +
        `IPv6 重试拖慢约 ${((r1.avg - r2.avg) / 1000).toFixed(2)}s。`
    );
  }
})();
