#!/usr/bin/env node
/**
 * 尝试用 Cloudflare API 关闭单个 DNS 记录的 IPv6（只生成 A，不生成 AAAA）。
 *
 * 背景：
 *   Cloudflare 的「IPv6 兼容性」总开关是 Enterprise 专属，
 *   但 DNS 记录级别可能有 settings.ipv4_only 字段。
 *   若该字段可用，可只让 aibiliai.com 这一条不再生成 AAAA。
 *
 * 用法：
 *   export CF_TOKEN="你的token"
 *   node scripts/cf-ipv4-only.mjs                # 只查询，不改
 *   node scripts/cf-ipv4-only.mjs --apply        # 实际修改
 *
 * 需要的 token 权限：
 *   模板 "Edit zone DNS"，Zone Resources 限定到 aibiliai.com
 */

const DOMAIN = "aibiliai.com";
const ZONE_NAME = "aibiliai.com";

const TOKEN = process.env.CF_TOKEN;
const APPLY = process.argv.includes("--apply");

const API = "https://api.cloudflare.com/client/v4";

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { headers: headers(), ...opts });
  const json = await res.json();

  if (!json.success) {
    throw new Error(JSON.stringify(json.errors || json, null, 2));
  }

  return json.result;
}

async function main() {
  if (!TOKEN) {
    console.error("✗ 未设置 CF_TOKEN");
    console.error('  用法：export CF_TOKEN="..." && node scripts/cf-ipv4-only.mjs');
    process.exit(1);
  }

  console.log("=".repeat(62));
  console.log(`Cloudflare DNS 记录 IPv6 设置${APPLY ? "（实际修改）" : "（只查询）"}`);
  console.log("=".repeat(62));
  console.log("");

  // ---------- 1. 找 zone ----------
  const zones = await api(`/zones?name=${ZONE_NAME}`);

  if (!zones.length) {
    console.error(`✗ 找不到 zone: ${ZONE_NAME}`);
    process.exit(1);
  }

  const zone = zones[0];
  console.log(`  zone: ${zone.name}  (id=${zone.id})`);
  console.log(`  套餐: ${zone.plan?.name || "(未知)"}`);
  console.log("");

  // ---------- 2. 查 DNS 记录 ----------
  const records = await api(`/zones/${zone.id}/dns_records?per_page=100`);

  const targets = records.filter(
    (r) => r.name === DOMAIN || r.name === `www.${DOMAIN}`,
  );

  if (!targets.length) {
    console.error(`✗ 没找到 ${DOMAIN} 的 DNS 记录`);
    process.exit(1);
  }

  console.log(`  找到 ${targets.length} 条相关记录：`);
  console.log("");

  for (const r of targets) {
    console.log(`  ── ${r.name} ──`);
    console.log(`    id:       ${r.id}`);
    console.log(`    type:     ${r.type}`);
    console.log(`    content:  ${r.content}`);
    console.log(`    proxied:  ${r.proxied}`);
    console.log(
      `    settings: ${r.settings ? JSON.stringify(r.settings) : "（该记录无 settings 字段）"}`,
    );
    console.log("");
  }

  // ---------- 3. 判断可行性 ----------
  const supports = targets.filter((r) => r.settings !== undefined && r.settings !== null);

  console.log("=".repeat(62));

  if (supports.length === 0) {
    console.log("结论：这些记录没有 settings 字段，");
    console.log("      说明当前套餐不支持记录级 ipv4_only。");
    console.log("");
    console.log("  → API 这条路也走不通。");
    process.exit(0);
  }

  console.log(`结论：${supports.length} 条记录带 settings 字段，可以尝试设置。`);

  if (!APPLY) {
    console.log("");
    console.log("  这是查询模式。确认无误后加 --apply 执行修改。");
    return;
  }

  // ---------- 4. 应用 ----------
  console.log("");

  for (const r of supports) {
    try {
      await api(`/zones/${zone.id}/dns_records/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ settings: { ipv4_only: true } }),
      });

      console.log(`  ✓ ${r.name} 已设置 ipv4_only`);
    } catch (e) {
      console.error(`  ✗ ${r.name} 失败: ${String(e.message).slice(0, 200)}`);
    }
  }

  console.log("");
  console.log("  验证方法（等 1-2 分钟后执行）：");
  console.log("    dig +short AAAA aibiliai.com @8.8.8.8");
  console.log("  若输出为空，说明 AAAA 已停止下发。");
}

main().catch((e) => {
  console.error("致命错误:", e.message);
  process.exit(1);
});
