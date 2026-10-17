#!/bin/bash
# ============================================================
#  回滚
#
#  用法：
#      ./rollback.sh              # 回退一个 commit
#      ./rollback.sh 3            # 回退 3 个
#      ./rollback.sh <commit>     # 回到指定 commit
#
#  适用于 deploy.sh（git 通道）部署后的回退。
#  deploy-rsync.sh 通道的部署用快照恢复，见脚本末尾提示。
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

ARG="${1:-1}"

log "0. 当前状态"
CUR=$(ssh "$SERVER" "cd $APP_DIR && git rev-parse --short HEAD")
ok "服务器 HEAD: $CUR"

# ---------- 计算目标 ----------
case "$ARG" in
    [0-9]*)
        TARGET=$(ssh "$SERVER" "cd $APP_DIR && git rev-parse --short HEAD~$ARG")
        DESC="回退 $ARG 个 commit"
        ;;
    *)
        TARGET=$(ssh "$SERVER" "cd $APP_DIR && git rev-parse --short $ARG")
        DESC="回到 $ARG"
        ;;
esac

[ -z "$TARGET" ] && die "无法确定目标 commit"

log "1. 回滚到 $TARGET（$DESC）"
ssh "$SERVER" "cd $APP_DIR && git reset --hard $TARGET" || die "git reset 失败"
ok "代码已回退"

log "2. 重建"
ssh "$SERVER" "cd $APP_DIR && npm ci --no-audit --no-fund && npx prisma generate && npm run build" \
    || die "重建失败（代码已是 $TARGET，但构建不通过）"
ok "重建完成"

log "3. 重启"
ssh "$SERVER" "cd $APP_DIR && pm2 restart $PM2_NAME --update-env" > /dev/null
sleep 8

log "4. 验证"
OK=0
for i in 1 2 3 4 5; do
    CODE=$(ssh "$SERVER" "curl -s -o /dev/null -m 20 -w '%{http_code}' $HEALTH_URL" 2>/dev/null || echo 000)
    [ "$CODE" = "200" ] && { ok "HTTP 200"; OK=1; break; }
    echo "  第 $i 次: HTTP $CODE"
    sleep 5
done

if [ "$OK" -eq 1 ]; then
    printf '\n\033[32m✓ 已回滚 %s → %s\033[0m\n' "$CUR" "$TARGET"
else
    printf '\n\033[31m✗ 回滚后仍不健康，需要人工介入\033[0m\n'
    echo "  ssh $SERVER"
    echo "  cd $APP_DIR && pm2 logs $PM2_NAME --lines 100 --nostream"
    exit 1
fi

cat <<'NOTE'

  如果是 rsync 通道部署的，用快照恢复：
      ssh 服务器 "ls -1t /root/.deploy-snapshots/*.tgz | head"
      ssh 服务器 "cd /root/ai-insight-daily && tar xzf <快照> && npm run build && pm2 restart ai-insight-daily"

NOTE
