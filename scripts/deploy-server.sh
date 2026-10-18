#!/bin/bash
# ============================================================
#  服务器端一键部署
#
#  在服务器上执行（或从本地 ssh 调用）：
#      bash scripts/deploy-server.sh
#
#  流程：git pull → 按需 npm ci → prisma generate → build
#        → pm2 restart → 健康检查 → 失败自动回滚
#
#  ## 为什么要有这个脚本
#
#  直接敲一长串命令容易漏步骤（尤其 prisma generate 和 build 的顺序）。
#  漏了 prisma generate 会出现「构建通过但运行时找不到模型」这种怪问题。
#
#  ## 回滚
#
#  健康检查失败时自动回到上一个 commit 并重建，不用人工介入。
# ============================================================

set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR" || exit 1

PM2_NAME="ai-insight-daily"
HEALTH_URL="http://127.0.0.1:3000/"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()  { printf '  ✓ %s\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*"; exit 1; }

log "0. 当前状态"
if [ -n "$(git status --porcelain)" ]; then
    printf '  ⚠ 工作区有未提交改动：\n'
    git status --short | head -5 | sed 's/^/    /'
    printf '  继续会丢弃这些改动（git pull 可能冲突）\n'
fi

PREV=$(git rev-parse --short HEAD)
ok "当前 commit: $PREV"

log "1. 拉取代码"
git fetch -q origin main || die "git fetch 失败（网络或密钥问题）"
git pull --ff-only -q origin main 2>/dev/null || {
    printf '  ⚠ 无法快进合并，尝试 reset（会丢弃本地改动）\n'
    git reset --hard origin/main
}
NEW=$(git rev-parse --short HEAD)
ok "$PREV → $NEW"

if [ "$PREV" = "$NEW" ]; then
    printf '\n  没有新提交。是否仍要重建？(y/N，5 秒后跳过) '
    read -t 5 -r ans || ans="n"
    if [ "$ans" != "y" ]; then
        printf '\n  已跳过。\n'
        exit 0
    fi
fi

log "2. 依赖"
if git diff --name-only "$PREV" "$NEW" -- package.json package-lock.json 2>/dev/null | grep -q .; then
    echo "  依赖有变化，执行 npm ci"
    npm ci --no-audit --no-fund > /dev/null 2>&1 || die "npm ci 失败"
    ok "依赖已更新"
else
    ok "依赖未变化，跳过"
fi

log "3. Prisma"
npx prisma generate > /dev/null 2>&1 || die "prisma generate 失败"
ok "client 已生成"

if git diff --name-only "$PREV" "$NEW" -- prisma/schema.prisma 2>/dev/null | grep -q .; then
    echo "  schema 有变化，执行 migrate"
    npx prisma migrate deploy || die "migrate 失败"
    ok "迁移已应用"
fi

log "4. 构建"
npm run build > /tmp/build-$$.log 2>&1
if [ $? -ne 0 ]; then
    tail -20 /tmp/build-$$.log | sed 's/^/    /'
    printf '\n\033[31m✗ 构建失败，回滚到 %s\033[0m\n' "$PREV"
    git reset --hard "$PREV"
    npm ci --no-audit --no-fund > /dev/null 2>&1
    npx prisma generate > /dev/null 2>&1
    npm run build > /dev/null 2>&1
    pm2 restart "$PM2_NAME" --update-env > /dev/null 2>&1
    die "已回滚到 $PREV"
fi
rm -f /tmp/build-$$.log
ok "构建完成"

log "5. 重启"
pm2 restart "$PM2_NAME" --update-env > /dev/null 2>&1 || die "pm2 restart 失败"
sleep 8
ok "已重启"

log "6. 健康检查"
OK=0
for i in 1 2 3 4 5; do
    CODE=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo 000)
    if [ "$CODE" = "200" ]; then
        ok "第 $i 次: HTTP 200"
        OK=1
        break
    fi
    printf '  第 %d 次: HTTP %s，等 5 秒\n' "$i" "$CODE"
    sleep 5
done

if [ "$OK" -ne 1 ]; then
    printf '\n\033[31m✗ 健康检查失败，回滚到 %s\033[0m\n' "$PREV"
    git reset --hard "$PREV"
    npm ci --no-audit --no-fund > /dev/null 2>&1
    npx prisma generate > /dev/null 2>&1
    npm run build > /dev/null 2>&1
    pm2 restart "$PM2_NAME" --update-env > /dev/null 2>&1
    sleep 8
    C2=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo 000)
    [ "$C2" = "200" ] && echo "  ✓ 已回滚到 $PREV 并恢复正常" || echo "  ✗ 回滚后仍异常，需要人工介入"
    exit 1
fi

log "部署完成"
echo "  $PREV → $NEW"
echo ""
echo "  查看日志: pm2 logs $PM2_NAME --lines 50 --nostream"
