#!/bin/bash
# ============================================================
#  部署（备用通道：rsync 直传，不依赖 GitHub）
#
#  在【本地 WSL】执行。
#  GitHub 抽风时用这个 —— 只要 SSH 通就能部署。
#
#  用法：
#      ./deploy-rsync.sh
#
#  跟 deploy.sh 的区别：
#      deploy.sh       从 GitHub 拉 → 有版本历史、能回滚
#      deploy-rsync.sh 本地直传 → 不依赖 GitHub，但服务器上的
#                      git 状态会变脏（不影响运行）
#
#  传输排除：
#      node_modules  服务器自己装（架构可能不同）
#      .next         服务器自己构建
#      .git          不需要
#      .env*         含密钥，单独传
#      backup/       历史备份，不需要
#      .migration/   本地专用
# ============================================================

set -euo pipefail

SERVER="${DEPLOY_SERVER:-root@CHANGE_ME}"
APP_DIR="${DEPLOY_APP_DIR:-/root/ai-insight-daily}"
PM2_NAME="${DEPLOY_PM2_NAME:-ai-insight-daily}"
HEALTH_URL="http://127.0.0.1:3000/"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()  { printf '  ✓ %s\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*"; exit 1; }

[ "$SERVER" = "root@CHANGE_ME" ] && die "未配置服务器地址（DEPLOY_SERVER）"

cd "$(git rev-parse --show-toplevel)"

log "0. 检查"
timeout 15 ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER" 'echo ok' > /dev/null 2>&1 \
    || die "SSH 连不上 $SERVER"
ok "SSH 可达"
ok "本地 HEAD: $(git rev-parse --short HEAD)$([ -n "$(git status --porcelain)" ] && echo '（有未提交改动，会一起传）')"

# ---------- 1. 记录回滚点 ----------
log "1. 记录回滚点"
ssh "$SERVER" "mkdir -p /root/.deploy-snapshots && cd $APP_DIR 2>/dev/null && tar czf /root/.deploy-snapshots/\$(date +%Y%m%d-%H%M%S).tgz --exclude=node_modules --exclude=.next --exclude=.git . 2>/dev/null || true"
SNAP=$(ssh "$SERVER" "ls -1t /root/.deploy-snapshots/*.tgz 2>/dev/null | head -1")
[ -n "$SNAP" ] && ok "快照: $(basename "$SNAP")"

# ---------- 2. 传代码 ----------
log "2. 传输代码"
rsync -az --delete \
    --exclude='node_modules/' \
    --exclude='.next/' \
    --exclude='.git/' \
    --exclude='backup/' \
    --exclude='.migration/' \
    --exclude='.mobile-shots/' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    --exclude='prisma/dev.db' \
    --exclude='prisma/dev.db-*' \
    --exclude='logs/' \
    --exclude='.tmp-*' \
    ./ "$SERVER:$APP_DIR/" || die "rsync 失败"

ok "代码已同步"

# ---------- 3. 依赖 ----------
log "3. 依赖"
ssh "$SERVER" "cd $APP_DIR && npm ci --no-audit --no-fund" || die "npm ci 失败"
ok "依赖已安装"

# ---------- 4. Prisma ----------
log "4. Prisma"
ssh "$SERVER" "cd $APP_DIR && npx prisma generate" > /dev/null || die "prisma generate 失败"
ssh "$SERVER" "cd $APP_DIR && mkdir -p prisma && [ -f prisma/dev.db ] || npx prisma migrate deploy" \
    || die "migrate 失败"
ok "完成"

# ---------- 5. 构建 ----------
log "5. 构建"
ssh "$SERVER" "cd $APP_DIR && npm run build" || die "构建失败"
ok "构建完成"

# ---------- 6. 重启 ----------
log "6. 重启"
ssh "$SERVER" "cd $APP_DIR && (pm2 restart $PM2_NAME --update-env > /dev/null 2>&1 || pm2 start npm --name $PM2_NAME -- start > /dev/null)"
sleep 8
ok "已重启"

# ---------- 7. 健康检查 ----------
log "7. 健康检查"
OK=0
for i in 1 2 3 4 5; do
    CODE=$(ssh "$SERVER" "curl -s -o /dev/null -m 20 -w '%{http_code}' $HEALTH_URL" 2>/dev/null || echo 000)
    if [ "$CODE" = "200" ]; then
        ok "HTTP 200"
        OK=1
        break
    fi
    echo "  第 $i 次: HTTP $CODE"
    sleep 5
done

if [ "$OK" -ne 1 ]; then
    printf '\n\033[31m✗ 健康检查失败\033[0m\n'
    if [ -n "$SNAP" ]; then
        echo "  快照可用：ssh $SERVER \"cd $APP_DIR && tar xzf $SNAP && npm run build && pm2 restart $PM2_NAME\""
    fi
    die "部署失败"
fi

log "部署完成（rsync 通道）"
echo ""
echo "  提示：此通道不经过 git，服务器端 git 状态会显示为脏。"
echo "  想恢复干净状态：ssh $SERVER \"cd $APP_DIR && git fetch && git reset --hard origin/main\""
