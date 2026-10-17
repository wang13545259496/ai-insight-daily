#!/bin/bash
# ============================================================
#  部署（主通道：GitHub）
#
#  在【本地 WSL】执行。前提：能访问 GitHub。
#  GitHub 不通时用 deploy-rsync.sh。
#
#  用法：
#      ./deploy.sh              # 部署当前分支最新 commit
#      ./deploy.sh --no-build   # 只重启不重建（改了 .env 时用）
#
#  流程：
#      本地检查 → ssh 服务器 → git pull → 按需 npm ci
#      → prisma generate → build → pm2 restart → 健康检查
#      → 失败自动回滚
# ============================================================

set -euo pipefail

# ---------- 配置（迁移时填）----------
SERVER="${DEPLOY_SERVER:-root@CHANGE_ME}"
APP_DIR="${DEPLOY_APP_DIR:-/root/ai-insight-daily}"
PM2_NAME="${DEPLOY_PM2_NAME:-ai-insight-daily}"
HEALTH_URL="http://127.0.0.1:3000/"
BRANCH="${DEPLOY_BRANCH:-main}"

NO_BUILD=0
[ "${1:-}" = "--no-build" ] && NO_BUILD=1

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()  { printf '  ✓ %s\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*"; exit 1; }

# ---------- 0. 前置检查 ----------
log "0. 前置检查"

[ "$SERVER" = "root@CHANGE_ME" ] && die "未配置服务器地址。请设置 DEPLOY_SERVER，或在脚本顶部改 SERVER。"

if [ -n "$(git status --porcelain)" ]; then
    die "本地有未提交的改动。先提交再部署，否则服务器拿到的代码和本地不一致。
      查看: git status"
fi

LOCAL_HEAD=$(git rev-parse --short HEAD)
ok "本地 HEAD: $LOCAL_HEAD"

timeout 15 ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER" 'echo ok' > /dev/null 2>&1 \
    || die "SSH 连不上 $SERVER。检查网络、密钥、安全组 22 端口。"
ok "SSH 可达"

# ---------- 1. 记录服务器当前版本（回滚用）----------
log "1. 记录回滚点"
PREV=$(ssh "$SERVER" "cd $APP_DIR && git rev-parse --short HEAD 2>/dev/null || echo none")
ok "服务器当前: $PREV"

# ---------- 2. 拉代码 ----------
log "2. 拉取代码"
ssh "$SERVER" "cd $APP_DIR && git fetch --quiet origin $BRANCH && git reset --hard origin/$BRANCH" \
    || die "git pull 失败（服务器无法访问 GitHub？改用 deploy-rsync.sh）"
REMOTE_HEAD=$(ssh "$SERVER" "cd $APP_DIR && git rev-parse --short HEAD")
ok "服务器 HEAD: $REMOTE_HEAD"

if [ "$REMOTE_HEAD" != "$LOCAL_HEAD" ]; then
    printf '  ⚠ 服务器版本(%s)与本地(%s)不一致\n' "$REMOTE_HEAD" "$LOCAL_HEAD"
fi

# ---------- 3. 依赖 ----------
log "3. 依赖"
LOCK_CHANGED=$(ssh "$SERVER" "cd $APP_DIR && git diff --name-only $PREV HEAD -- package-lock.json package.json 2>/dev/null | wc -l")
if [ "$LOCK_CHANGED" -gt 0 ] || [ "$PREV" = "none" ]; then
    echo "  依赖有变化，执行 npm ci（约 1-3 分钟）"
    ssh "$SERVER" "cd $APP_DIR && npm ci --no-audit --no-fund" || die "npm ci 失败"
    ok "依赖已安装"
else
    ok "依赖未变化，跳过 npm ci"
fi

# ---------- 4. Prisma ----------
log "4. Prisma"
ssh "$SERVER" "cd $APP_DIR && npx prisma generate" > /dev/null || die "prisma generate 失败"
ok "client 已生成"

SCHEMA_CHANGED=$(ssh "$SERVER" "cd $APP_DIR && git diff --name-only $PREV HEAD -- prisma/schema.prisma 2>/dev/null | wc -l")
if [ "$SCHEMA_CHANGED" -gt 0 ]; then
    echo "  schema 有变化，执行 migrate"
    ssh "$SERVER" "cd $APP_DIR && npx prisma migrate deploy" || die "migrate 失败"
    ok "迁移已应用"
else
    ok "schema 未变化"
fi

# ---------- 5. 构建 ----------
if [ "$NO_BUILD" -eq 1 ]; then
    log "5. 构建（已跳过 --no-build）"
else
    log "5. 构建（约 1-2 分钟，小内存机器会慢）"
    ssh "$SERVER" "cd $APP_DIR && npm run build" || die "构建失败（已在 git reset 状态，可 rollback.sh 回退）"
    ok "构建完成"
fi

# ---------- 6. 重启 ----------
log "6. 重启"
ssh "$SERVER" "cd $APP_DIR && pm2 restart $PM2_NAME --update-env" > /dev/null 2>&1 \
    || ssh "$SERVER" "cd $APP_DIR && pm2 start npm --name $PM2_NAME -- start" > /dev/null
sleep 8
ok "已重启"

# ---------- 7. 健康检查 ----------
log "7. 健康检查"
HEALTH_OK=0
for i in 1 2 3 4 5; do
    CODE=$(ssh "$SERVER" "curl -s -o /dev/null -m 20 -w '%{http_code}' $HEALTH_URL" 2>/dev/null || echo 000)
    if [ "$CODE" = "200" ]; then
        ok "第 $i 次: HTTP 200"
        HEALTH_OK=1
        break
    fi
    echo "  第 $i 次: HTTP $CODE，等 5 秒重试"
    sleep 5
done

# ---------- 8. 失败回滚 ----------
if [ "$HEALTH_OK" -ne 1 ]; then
    printf '\n\033[31m✗ 健康检查失败，自动回滚到 %s\033[0m\n' "$PREV"
    if [ "$PREV" != "none" ]; then
        ssh "$SERVER" "cd $APP_DIR && git reset --hard $PREV && npm ci --no-audit --no-fund && npx prisma generate && npm run build && pm2 restart $PM2_NAME --update-env" \
            && echo "  ✓ 已回滚到 $PREV" \
            || echo "  ✗ 回滚也失败了，需要人工介入：ssh $SERVER"
    fi
    die "部署失败"
fi

# ---------- 9. 完成 ----------
log "部署完成"
echo "  版本: $PREV → $REMOTE_HEAD"
echo "  回滚: ./rollback.sh $SERVER"
echo ""
echo "  看日志: ssh $SERVER \"pm2 logs $PM2_NAME --lines 50 --nostream\""
