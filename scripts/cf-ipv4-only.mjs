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

/**
 * 校验 token 格式。
 *
 * 直接把手里的字符串塞进 Authorization 头时，若含非 ASCII 字符，
 * fetch 会抛出难以理解的内层错误：
 *   Cannot convert argument to a ByteString because the character at
 *   index 7 has a value of 31896 which is greater than 255.
 * 因此提前检查，给出能照着做的提示。
 */
function validateToken(token) {
  if (!token) {
    return "未设置 CF_TOKEN";
  }

  const badChar = [...token].find((c) => c.charCodeAt(0) > 127);

  if (badChar) {
    const idx = [...token].indexOf(badChar);

    return (
      `CF_TOKEN 含有非 ASCII 字符「${badChar}」（第 ${idx + 1} 个字符）。\n` +
      "  Cloudflare 的 token 只由英文字母与数字组成。\n" +
      "  最常见的原因是直接复制了文档里的占位符，没有换成真实 token。"
    );
  }

  if (/\s/.test(token)) {
    return "CF_TOKEN 含有空格或换行，复制时可能带入了多余字符";
  }

  if (token.length < 30) {
    return `CF_TOKEN 长度只有 ${token.length}，Cloudflare 的 token 通常约 40 字符，可能复制不完整`;
  }

  return null;
}

async function main() {
  const tokenError = validateToken(TOKEN);

  if (tokenError) {
    console.error("");
    console.error(`✗ ${tokenError}`);
    console.error("");
    console.error("  正确的用法：");
    console.error('    export CF_TOKEN="真实的token字符串"');
    console.error("    node scripts/cf-ipv4-only.mjs");
    console.error("");
    console.error("  获取 token：");
    console.error("    https://dash.cloudflare.com/profile/api-tokens");
    console.error('    → Create Token → 模板选 "Edit zone DNS"');
    console.error("    → Zone Resources 限定到 aibiliai.com");
    console.error("");
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
