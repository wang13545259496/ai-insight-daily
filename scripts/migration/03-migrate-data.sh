#!/bin/bash
# ============================================================
#  数据迁移：把数据库、配置、定时任务搬到服务器
#
#  在【本地 WSL】执行，前提：代码已通过 deploy-rsync.sh 或
#  deploy.sh 传到服务器。
#
#  用法：
#      ./03-migrate-data.sh
#
#  做三件事：
#      1. 传数据库（先停本地服务写入，避免拷贝到写一半的库）
#      2. 传 .env.local / .env.production
#      3. 在服务器上生成 crontab（路径自动改写成本机路径）
# ============================================================

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@CHANGE_ME}"
APP_DIR="${DEPLOY_APP_DIR:-/root/ai-insight-daily}"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()  { printf '  ✓ %s\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*"; exit 1; }

[ "$SERVER" = "root@CHANGE_ME" ] && die "未配置服务器地址（DEPLOY_SERVER）"

cd "$(git rev-parse --show-toplevel)"

log "0. 检查"
timeout 15 ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER" 'echo ok' > /dev/null 2>&1 \
    || die "SSH 连不上 $SERVER"
ssh "$SERVER" "test -d $APP_DIR" || die "服务器上 $APP_DIR 不存在，先跑 deploy 传代码"
ok "SSH 可达，目录存在"

# ---------- 1. 数据库 ----------
log "1. 数据库"

echo "  暂停本地定时任务（避免拷贝时正在写入）"
LOCAL_CRON_BACKUP="/root/crontab-backup-$(date +%Y%m%d-%H%M%S).txt"
crontab -l > "$LOCAL_CRON_BACKUP" 2>/dev/null || true
crontab -r 2>/dev/null || true
ok "本地 crontab 已暂停（备份: $LOCAL_CRON_BACKUP）"

echo "  备份本地数据库"
if [ -f prisma/dev.db ]; then
    TS=$(date +%Y%m%d-%H%M%S)
    sqlite3 prisma/dev.db ".backup 'backup/dev_${TS}_premigrate.db'" 2>/dev/null \
        || cp prisma/dev.db "backup/dev_${TS}_premigrate.db"
    ok "本地备份: backup/dev_${TS}_premigrate.db"
else
    die "找不到 prisma/dev.db"
fi

echo "  上传数据库（11MB 左右）"
rsync -avz --progress prisma/dev.db "$SERVER:$APP_DIR/prisma/dev.db" || die "数据库上传失败"
ok "已上传"

echo "  校验完整性"
LOCAL_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM News;" 2>/dev/null || echo "?")
REMOTE_COUNT=$(ssh "$SERVER" "sqlite3 $APP_DIR/prisma/dev.db 'SELECT COUNT(*) FROM News;'" 2>/dev/null || echo "?")
printf '  本地 News: %s 条\n  远端 News: %s 条\n' "$LOCAL_COUNT" "$REMOTE_COUNT"
[ "$LOCAL_COUNT" = "$REMOTE_COUNT" ] && ok "一致" || die "数量不一致，数据库可能损坏"

# ---------- 2. 配置文件 ----------
log "2. 配置文件"

for F in .env.local .env.production; do
    if [ -f "$F" ]; then
        scp -q "$F" "$SERVER:$APP_DIR/$F" || die "$F 上传失败"
        ssh "$SERVER" "chmod 600 $APP_DIR/$F"
        N=$(grep -cE '^[A-Z_]+=' "$F" 2>/dev/null || echo 0)
        ok "$F（$N 个变量，权限 600）"
    else
        echo "  — $F 不存在，跳过"
    fi
done

# ---------- 3. 定时任务 ----------
log "3. 定时任务"

TMPCRON=$(mktemp)
{
    echo "# AI Insight Daily 定时任务"
    echo "# 从本地迁移，路径已改写为 $APP_DIR"
    echo ""
    echo "# 每小时采集 + AI 分析"
    echo "0 * * * * $APP_DIR/scripts/news-pipeline-scheduler.sh >> $APP_DIR/logs/cron-news.log 2>&1"
    echo "@reboot sleep 180 && $APP_DIR/scripts/news-pipeline-scheduler.sh >> $APP_DIR/logs/cron-news.log 2>&1"
    echo ""
    echo "# 每小时健康检查（挂了推微信）"
    echo "15 * * * * $APP_DIR/scripts/health-monitor.sh >> $APP_DIR/logs/cron-health.log 2>&1"
    echo "@reboot sleep 240 && $APP_DIR/scripts/health-monitor.sh >> $APP_DIR/logs/cron-health.log 2>&1"
    echo ""
    echo "# 每天 23:00 数据库备份"
    echo "0 23 * * * $APP_DIR/scripts/db-backup-scheduler.sh >> $APP_DIR/logs/cron-backup.log 2>&1"
    echo "@reboot sleep 120 && $APP_DIR/scripts/db-backup-scheduler.sh >> $APP_DIR/logs/cron-backup.log 2>&1"
    echo ""
    echo "# 每天 22:30 日报推送"
    echo "30 22 * * * $APP_DIR/scripts/daily-report.sh >> $APP_DIR/logs/cron-report.log 2>&1"
    echo "@reboot sleep 300 && $APP_DIR/scripts/daily-report.sh catchup >> $APP_DIR/logs/cron-report.log 2>&1"
} > "$TMPCRON"

ssh "$SERVER" "mkdir -p $APP_DIR/logs"
scp -q "$TMPCRON" "$SERVER:/tmp/ai-crontab.txt"
ssh "$SERVER" "crontab /tmp/ai-crontab.txt && rm -f /tmp/ai-crontab.txt"
rm -f "$TMPCRON"
ok "已导入 8 条任务"

echo ""
echo "  服务器 crontab:"
ssh "$SERVER" "crontab -l" | grep -vE '^#|^$' | sed 's/^/    /'

# ---------- 4. 脚本可执行权限 ----------
log "4. 脚本权限"
ssh "$SERVER" "cd $APP_DIR && chmod +x scripts/*.sh 2>/dev/null; echo done" > /dev/null
ok "scripts/*.sh 已加执行权限"

# ---------- 5. 提示 ----------
log "完成"
cat <<EOF

  接下来：
    1. 在服务器上构建并启动：
         ssh $SERVER "cd $APP_DIR && npm run build && pm2 start npm --name ai-insight-daily -- start"
    2. 本地执行 04-verify.sh 验证全链路
    3. 验证通过后执行 05-decommission-local.sh 停掉本地服务

  本地 crontab 已暂停，备份在 $LOCAL_CRON_BACKUP
  如需恢复：crontab $LOCAL_CRON_BACKUP

EOF
