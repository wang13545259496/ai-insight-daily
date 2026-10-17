#!/bin/bash
# ============================================================
#  迁移预检：摸清要搬什么，生成迁移包
#
#  在【本地 WSL】执行。只读，不改任何东西。
#
#  产出：
#    .migration/migration-manifest.md   迁移清单（人看）
#    .migration/dev.db                  数据库快照
#    .migration/env.keys.txt            配置变量清单（只有名字，不含值）
#    .migration/crontab.txt             定时任务
#    .migration/package.json.summary    依赖概要
# ============================================================

set -u
cd "$HOME/projects/ai-insight-daily" || exit 1

OUT="$HOME/projects/ai-insight-daily/.migration"
mkdir -p "$OUT"

echo "########## 迁移预检 ##########"
echo ""

# ---------- 1. 数据库 ----------
echo "=== 1. 数据库快照 ==="
if [ -f prisma/dev.db ]; then
  cp prisma/dev.db "$OUT/dev.db"
  SIZE=$(du -h "$OUT/dev.db" | cut -f1)
  echo "  ✓ 已复制 $SIZE → .migration/dev.db"
  node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('$OUT/dev.db', { readOnly: true });
const t = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
let total = 0, rows = 0;
for (const x of t) {
  if (x.name.startsWith('sqlite_') || x.name.startsWith('_prisma')) continue;
  try {
    const c = db.prepare('SELECT COUNT(*) c FROM \"' + x.name + '\"').get().c;
    rows += c; total++;
  } catch(e) {}
}
console.log('    表数量: ' + total + '，总行数: ' + rows);
db.close();
" 2>&1 | grep -v ExperimentalWarning | grep -v trace
else
  echo "  ✗ 找不到 prisma/dev.db"
fi

# ---------- 2. 环境变量清单（只列名字）----------
echo ""
echo "=== 2. 配置变量清单（不含值）==="
: > "$OUT/env.keys.txt"
for F in .env.local .env.production .env; do
  [ -f "$F" ] || continue
  echo "# $F" >> "$OUT/env.keys.txt"
  grep -E '^[A-Z_]+=' "$F" 2>/dev/null | cut -d= -f1 | sed 's/^/  /' | tee -a "$OUT/env.keys.txt" > /dev/null
  N=$(grep -cE '^[A-Z_]+=' "$F" 2>/dev/null)
  echo "  $F: $N 个变量"
done
echo ""
echo "  变量名:"
grep -v '^#' "$OUT/env.keys.txt" | grep -v '^$' | sed 's/^/    /'

# ---------- 3. crontab ----------
echo ""
echo "=== 3. 定时任务 ==="
crontab -l 2>/dev/null > "$OUT/crontab.txt" || true
N=$(grep -vcE '^#|^$' "$OUT/crontab.txt" 2>/dev/null || echo 0)
echo "  $N 条有效任务 → .migration/crontab.txt"
grep -vE '^#|^$' "$OUT/crontab.txt" 2>/dev/null | sed 's/^/    /'

# ---------- 4. 依赖概要 ----------
echo ""
echo "=== 4. 依赖 ==="
node -e "
const p = require('./package.json');
const deps = Object.keys(p.dependencies || {});
const dev = Object.keys(p.devDependencies || {});
console.log('  运行时依赖: ' + deps.length + ' 个');
console.log('  开发依赖:   ' + dev.length + ' 个');
console.log('  关键包:');
for (const k of ['next','react','prisma','@prisma/client','typescript']) {
  const v = (p.dependencies||{})[k] || (p.devDependencies||{})[k];
  if (v) console.log('    ' + k.padEnd(18) + v);
}
console.log('  Node 要求: ' + (p.engines?.node || '未声明'));
" > "$OUT/package.json.summary" 2>&1
sed 's/^/  /' "$OUT/package.json.summary"

# ---------- 5. 运行时信息 ----------
echo ""
echo "=== 5. 运行时版本 ==="
echo "  Node:   $(node -v)"
echo "  npm:    $(npm -v)"
echo "  PM2:    $(pm2 -v 2>/dev/null || echo '未安装')"
echo "  sqlite3: $(sqlite3 --version 2>/dev/null | cut -d' ' -f1 || echo '未安装（系统级）')"

# ---------- 6. 外部依赖清单 ----------
echo ""
echo "=== 6. 外部服务 ==="
for K in DEEPSEEK SERVERCHAN CRON TELEGRAM; do
  V=$(grep -hE "^[A-Z_]*${K}[A-Z_]*=" .env.local 2>/dev/null | cut -d= -f1 | head -3 | tr '\n' ' ')
  [ -n "$V" ] && echo "  $K: $V"
done

# ---------- 7. 目录体积 ----------
echo ""
echo "=== 7. 体积（决定传输方式）==="
echo "  代码+依赖:  $(du -sh --exclude=.next --exclude=node_modules --exclude=backup --exclude=.git . 2>/dev/null | cut -f1)"
echo "  数据库:     $(du -sh prisma/dev.db 2>/dev/null | cut -f1)"
echo "  .git:       $(du -sh .git 2>/dev/null | cut -f1)"
echo "  备份目录:   $(du -sh backup 2>/dev/null | cut -f1)"

# ---------- 8. 生成清单 ----------
echo ""
echo "=== 8. 生成迁移清单 ==="
cat > "$OUT/migration-manifest.md" <<EOF
# 迁移清单（自动生成）

生成时间：$(date '+%Y-%m-%d %H:%M:%S')

## 要搬的东西

| 项 | 来源 | 去向 | 方式 |
| --- | --- | --- | --- |
| 代码 | git 仓库 | 服务器 ~/ai-insight-daily | git clone |
| 数据库 | prisma/dev.db | 服务器同路径 | scp |
| 配置 | .env.local | 服务器同路径 | scp（含密钥，勿进 git） |
| 定时任务 | crontab | 服务器 crontab | 脚本导入 |
| 上传文件 | public/uploads（若有） | 服务器同路径 | rsync |

## 不要搬的

| 项 | 原因 |
| --- | --- |
| node_modules | 服务器重新 npm ci |
| .next | 服务器重新 build |
| backup/ | 历史备份，服务器已从 GitHub 拉 |
| .migration/ | 仅本地用 |

## 配置变量（值需重新提供）

\`\`\`
$(grep -v '^#' "$OUT/env.keys.txt" | grep -v '^$')
\`\`\`

## 定时任务

\`\`\`
$(grep -vE '^#|^$' "$OUT/crontab.txt")
\`\`\`

## 迁移后必须停掉的本地服务

- [ ] \`pm2 stop ai-insight-daily\`
- [ ] \`pm2 delete ai-insight-daily\`
- [ ] \`crontab -r\`（清空，先备份）
- [ ] \`sudo systemctl stop cloudflared-ipv4\`
- [ ] \`sudo systemctl disable cloudflared-ipv4\`

**不停会怎样**：本地和服务器同时采集，同一批新闻采两遍，
AI 费用翻倍，且两边数据库不一致。
EOF

echo "  ✓ .migration/migration-manifest.md"
echo ""
echo "  产出目录: $OUT"
ls -la "$OUT" | tail -n +2 | awk '{printf "    %-28s %s\n", $9, $5}'
