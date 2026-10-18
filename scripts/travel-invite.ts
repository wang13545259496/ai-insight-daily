/**
 * 旅行模块邀请码管理
 *
 * 用法：
 *   npx tsx scripts/travel-invite.ts --note "张三" --days 1   生成一个码
 *   npx tsx scripts/travel-invite.ts --list                   查看所有码
 *   npx tsx scripts/travel-invite.ts --revoke TRV-7K2M-9X4P   撤销未使用的码
 *
 * ## 为什么做成命令行而不是网页
 *
 * 网页管理后台需要自己再做一套鉴权 —— 而它保护的正是访问凭证，
 * 一旦这个后台被绕过，整个旅行模块的门就开了。
 * 命令行只对能登录服务器的人可用，没有新增攻击面。
 *
 * ## 为什么用动态 import
 *
 * lib/travel-invite 依赖 lib/prisma，prisma 在模块顶层读 DATABASE_URL。
 * ES 模块的 import 会被提升到文件顶部、先于 dotenv.config() 执行，
 * 静态 import 会导致环境变量还没加载。所以必须先 dotenv 再 await import。
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

function parseArgs() {
  const args = process.argv.slice(2);

  const getValue = (flag: string): string | null => {
    const i = args.indexOf(flag);

    return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
  };

  return {
    list: args.includes("--list"),
    revoke: args.includes("--revoke") ? getValue("--revoke") : null,
    note: getValue("--note"),
    days: getValue("--days") ? Number(getValue("--days")) : undefined,
  };
}

function fmt(date: Date): string {
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

async function main() {
  const opts = parseArgs();

  const [{ createInvite, listInvites, revokeInvite }, { prisma }] = await Promise.all([
    import("../lib/travel-invite"),
    import("../lib/prisma"),
  ]);

  // ---------- 列表 ----------
  if (opts.list) {
    const rows = await listInvites();

    if (!rows.length) {
      console.log("还没有生成过邀请码");
      return;
    }

    const now = Date.now();

    console.log(`共 ${rows.length} 个邀请码\n`);
    console.log("  状态    备注            创建时间            过期时间            兑换时间");
    console.log("  " + "-".repeat(84));

    for (const r of rows) {
      const used = r.usedAt !== null;
      const expired = r.expiresAt.getTime() <= now;

      const status = used ? "已使用" : expired ? "已过期" : "可用";

      console.log(
        `  ${status.padEnd(6)}  ${(r.note || "-").slice(0, 12).padEnd(14)}  ${fmt(r.createdAt).padEnd(19)}  ${(used ? "-" : fmt(r.expiresAt)).padEnd(19)}  ${used ? fmt(r.usedAt!) : "-"}`,
      );

      if (used && r.usedIp) {
        console.log(`          来自 ${r.usedIp}`);
      }
    }

    console.log("");
    console.log("  说明：码的明文只在生成时显示一次，这里无法查看。");

    return;
  }

  // ---------- 撤销 ----------
  if (opts.revoke) {
    const ok = await revokeInvite(opts.revoke);

    if (ok) {
      console.log(`✓ 已撤销 ${opts.revoke}（仅对未使用的码有效）`);
    } else {
      console.log(`✗ 撤销失败：码不存在，或已经被使用过`);
      console.log("  已使用的码无法撤销 —— 会话有效期到了自然失效。");
    }

    return;
  }

  // ---------- 生成 ----------
  if (!opts.note) {
    console.log("用法：");
    console.log('  npx tsx scripts/travel-invite.ts --note "张三" [--days 1]');
    console.log("  npx tsx scripts/travel-invite.ts --list");
    console.log("  npx tsx scripts/travel-invite.ts --revoke TRV-XXXX-XXXX");
    console.log("");
    console.log("  --note 必填：用来记住这个码给谁了");
    console.log("  --days 可选：有效期天数，默认 1 天");
    return;
  }

  const days = Number.isFinite(opts.days) && (opts.days as number) > 0 ? (opts.days as number) : 1;

  const invite = await createInvite({ note: opts.note, days });

  console.log("");
  console.log("  ┌────────────────────────────────────────────┐");
  console.log("  │  邀请码（只显示这一次）                    │");
  console.log("  ├────────────────────────────────────────────┤");
  console.log(`  │  ${invite.code.padEnd(42)}│`);
  console.log("  └────────────────────────────────────────────┘");
  console.log("");
  console.log(`  备注：    ${opts.note}`);
  console.log(`  有效期：  ${days} 天（到 ${fmt(invite.expiresAt)}）`);
  console.log(`  登录后：  会话 1 天，每小时最多生成 5 次行程`);
  console.log("");
  console.log("  把码发给对方，让他打开 https://aibiliai.com/agent-travel/login");
  console.log("  码只能用一次，用掉就作废 —— 转发给别人也没用。");

  // 生成后顺便确认库里有记录（避免「显示了但没存进去」）
  const check = await listInvites();

  console.log("");
  console.log(`  库中现有 ${check.length} 个邀请码`);

  void prisma;
}

main()
  .catch((e) => {
    console.error("执行失败：", e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");

    await prisma.$disconnect();
  });
