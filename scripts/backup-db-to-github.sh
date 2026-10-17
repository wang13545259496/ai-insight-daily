#!/bin/bash
#
# 把 SQLite 数据库备份到 GitHub 私有仓库的独立分支。
#
# 为什么需要它：原先的备份只存在本机 backup/ 目录 ——
# 数据库与备份在同一块硬盘上，硬盘坏了就一起没。这不是备份。
#
# 设计取舍：
#
# 1. **用 SQLite 的 .backup 而不是 cp**。数据库在服务运行时持续写入，
#    直接复制可能拿到撕裂的快照（主文件与 WAL 不一致）。
#    .backup 由 SQLite 自己保证一致性。
#
# 2. **用独立分支 db-backup**，与 main 完全隔离（孤儿分支，无共同历史）。
#    二进制文件不会污染代码仓库的历史。
#
# 3. **只保留最新一份，靠 git 历史保存旧版本**。
#    数据库会随资讯累积而变大，反复提交会让仓库无上限膨胀。
#    每次用 amend + force push 覆盖分支，仓库体积只等于当前一份。
#    旧版本仍可从 GitHub 的提交历史中找回。
#
# 4. **gzip 压缩**。SQLite 里大量是中文文本，压缩比很高。
#
# 退出码：0 成功；非 0 失败（供 cron 记录）

set -u

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="db-backup"
WORKTREE="$HOME/.db-backup-worktree"
DB="$PROJECT_DIR/prisma/dev.db"
REMOTE="origin"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "===== 备份开始 ====="

# ---------- 1. 前置检查 ----------
if [ ! -f "$DB" ]; then
  log "✗ 找不到数据库: $DB"
  exit 1
fi

cd "$PROJECT_DIR" || { log "✗ 无法进入项目目录"; exit 1; }

# ---------- 2. 一致性快照 ----------
SNAP="/tmp/db-snapshot-$$.db"

if command -v sqlite3 > /dev/null 2>&1; then
  # 优先用 sqlite3 的 .backup（一致性最好）
  sqlite3 "$DB" ".backup '$SNAP'" 2>/dev/null
  if [ ! -s "$SNAP" ]; then
    log "  sqlite3 备份失败，回退到 python"
    rm -f "$SNAP"
  fi
fi

if [ ! -s "$SNAP" ]; then
  # 回退：python 的 sqlite3 备份 API，同样保证一致性
  python3 - "$DB" "$SNAP" <<'PY' 2>/dev/null
import sqlite3, sys
src, dst = sys.argv[1], sys.argv[2]
s = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
d = sqlite3.connect(dst)
s.backup(d)
d.close()
s.close()
PY
fi

if [ ! -s "$SNAP" ]; then
  log "✗ 无法生成一致性快照"
  exit 1
fi

RAW_SIZE=$(stat -c%s "$SNAP")
log "  快照: $((RAW_SIZE / 1024)) KB"

# 完整性校验：能打开且表可读，才认为快照可用
if command -v sqlite3 > /dev/null 2>&1; then
  INTEGRITY=$(sqlite3 "$SNAP" "PRAGMA integrity_check;" 2>/dev/null | head -1)
  if [ "$INTEGRITY" != "ok" ]; then
    log "✗ 快照完整性校验失败: $INTEGRITY"
    rm -f "$SNAP"
    exit 1
  fi
  log "  完整性校验: ok"
fi

# ---------- 3. 压缩 ----------
STAMP=$(date +%Y-%m-%d_%H-%M-%S)
GZ="/tmp/dev_$STAMP.db.gz"

gzip -9 -c "$SNAP" > "$GZ" || { log "✗ 压缩失败"; rm -f "$SNAP"; exit 1; }
GZ_SIZE=$(stat -c%s "$GZ")
log "  压缩后: $((GZ_SIZE / 1024)) KB（压缩率 $((GZ_SIZE * 100 / RAW_SIZE))%）"

rm -f "$SNAP"

# ---------- 4. 准备 worktree ----------
if [ ! -d "$WORKTREE/.git" ] && [ ! -f "$WORKTREE/.git" ]; then
  rm -rf "$WORKTREE"

  # 远端是否已有该分支
  if git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" > /dev/null 2>&1; then
    log "  检出远端分支 $BRANCH"
    git fetch "$REMOTE" "$BRANCH" --quiet 2>/dev/null
    git worktree add --force -B "$BRANCH" "$WORKTREE" "$REMOTE/$BRANCH" --quiet 2>/dev/null \
      || { log "✗ worktree 创建失败"; exit 1; }
  else
    log "  创建孤儿分支 $BRANCH"
    git worktree add --force --detach "$WORKTREE" --quiet 2>/dev/null \
      || { log "✗ worktree 创建失败"; exit 1; }
    ( cd "$WORKTREE" && git checkout --orphan "$BRANCH" --quiet && git rm -rf . --quiet 2>/dev/null || true )
  fi
fi

[ -d "$WORKTREE" ] || { log "✗ worktree 不可用"; exit 1; }

cd "$WORKTREE" || exit 1

# ---------- 5. 只保留最新一份 ----------
find . -maxdepth 1 -name "dev_*.db.gz" -type f -delete 2>/dev/null
cp "$GZ" "./dev_$STAMP.db.gz"
rm -f "$GZ"

cat > README.md <<EOF
# 数据库备份

本分支由 \`scripts/backup-db-to-github.sh\` 自动维护，**请勿手动修改**。

- 内容：\`prisma/dev.db\` 的一致性快照（gzip 压缩）
- 分支：与 \`main\` 无共同历史的孤儿分支，二进制文件不会污染代码历史
- 保留策略：只保留最新一份；旧版本可从本分支的提交历史中找回

## 恢复方法

\`\`\`bash
git fetch origin db-backup
git show origin/db-backup:dev_<日期>.db.gz | gunzip > prisma/dev.db
\`\`\`

恢复后需重启服务：\`pm2 restart ai-insight-daily\`
EOF

# ---------- 6. 提交并推送 ----------
git add -A

if git diff --cached --quiet 2>/dev/null; then
  log "  数据库无变化，跳过推送"
  exit 0
fi

BACKUP_FILE=$(ls dev_*.db.gz 2>/dev/null | head -1)

if git rev-parse --verify HEAD > /dev/null 2>&1; then
  # 已有提交：amend 覆盖，保证分支只有一个提交
  git commit --amend --no-edit --quiet 2>/dev/null || git commit -m "backup: $STAMP" --quiet
else
  git commit -m "backup: $STAMP" --quiet
fi

# 记录数据库统计，便于在 GitHub 上直接看到备份内容。
# 用重写而不是追加 —— README 在上一次 amend 后仍留在 worktree 里，
# 追加会让它每备份一次就多一段重复内容。
{
  echo "# 数据库备份"
  echo ""
  echo "本分支由 \`scripts/backup-db-to-github.sh\` 自动维护，**请勿手动修改**。"
  echo ""
  echo "## 最近一次备份"
  echo ""
  echo "| 项 | 值 |"
  echo "| --- | --- |"
  echo "| 时间 | $STAMP |"
  echo "| 文件 | \`$BACKUP_FILE\` |"
  echo "| 压缩后 | $((GZ_SIZE / 1024)) KB |"
  echo "| 原始大小 | $((RAW_SIZE / 1024)) KB |"
  echo ""
  echo "## 说明"
  echo ""
  echo "- 内容：\`prisma/dev.db\` 的一致性快照（SQLite \`.backup\`，gzip 压缩）"
  echo "- 分支：与 \`main\` 无共同历史的孤儿分支，二进制文件不会污染代码历史"
  echo "- 保留策略：只保留最新一份；旧版本可从本分支的提交历史中找回"
  echo "- 调度：每天 23:00 触发，开机时补跑（见 \`scripts/db-backup-scheduler.sh\`）"
  echo ""
  echo "## 恢复方法"
  echo ""
  echo '```bash'
  echo "git fetch origin db-backup"
  echo "git show origin/db-backup:$BACKUP_FILE | gunzip > prisma/dev.db"
  echo "pm2 restart ai-insight-daily"
  echo '```'
  echo ""
  echo "## 换新机器时的完整恢复清单"
  echo ""
  echo "本分支只存数据库。以下内容需要另外准备："
  echo ""
  echo "| 项 | 存放位置 |"
  echo "| --- | --- |"
  echo "| 代码 | \`main\` 分支，\`git clone\` 即可 |"
  echo "| 数据库 | 本分支，见上方恢复方法 |"
  echo "| 环境变量 | **需另行保存**：\`DEEPSEEK_API_KEY\`、\`AMAP_WEB_KEY\`、"
  echo "\`QWEATHER_KEY\`、\`QWEATHER_HOST\`、\`VARIFLIGHT_API_KEY\`、"
  echo "\`ROLLINGGO_API_KEY\`、\`CRON_SECRET\`、\`TRAVEL_PASSWORD\`、\`COOKIE_SECURE\` |"
  echo "| 隧道凭据 | Cloudflare 后台重新生成 token |"
  echo "| nginx 配置 | \`server_name\` + 反代到 127.0.0.1:3000 |"
  echo ""
  echo "> 除 \`TRAVEL_PASSWORD\` 外，其余 Key 都能从对应服务商后台重新获取。"
  echo "> **\`TRAVEL_PASSWORD\` 是自定义的，丢了就只能换一个新的。**"
} > README.md

git add README.md
git commit --amend --no-edit --quiet 2>/dev/null

if git push --force "$REMOTE" "$BRANCH" --quiet 2>&1; then
  log "✓ 已推送到 $REMOTE/$BRANCH"
else
  log "✗ 推送失败（检查网络与 SSH 权限）"
  exit 1
fi

log "===== 备份完成 ====="
exit 0
