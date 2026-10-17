#!/bin/bash
# ============================================================
#  停用本地服务
#
#  在【本地 WSL】执行，仅在 04-verify.sh 全部通过之后。
#
#  ⚠️  这一步不可逆（但可以恢复，见脚本末尾说明）
#
#  为什么必须做：
#      本地和服务器同时跑 cron，会同时采集、同时调 AI，
#      同一批新闻采两遍，AI 费用翻倍，且两边数据库不一致。
#
#  用法：
#      ./05-decommission-local.sh --dry-run   # 只看会做什么
#      ./05-decommission-local.sh --apply     # 真的停
# ============================================================

set -uo pipefail

MODE="${1:-}"
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/root/premigrate-backup-$TS"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()  { printf '  ✓ %s\n' "$*"; }
skip(){ printf '  — %s\n' "$*"; }

if [ "$MODE" != "--apply" ]; then
    cat <<EOF

  这是预演模式（dry-run）。会做以下事情：

    1. 备份 crontab → $BACKUP_DIR/crontab.txt
    2. 清空 crontab
    3. 停止并删除 PM2 进程 ai-insight-daily
    4. 停止并禁用 cloudflared-ipv4 服务
    5. 保留：代码、数据库、node_modules（随时能恢复）

  确认无误后执行：
      ./05-decommission-local.sh --apply

  恢复方法（脚本末尾会再提示一次）：
      crontab $BACKUP_DIR/crontab.txt
      cd ~/projects/ai-insight-daily && pm2 start npm --name ai-insight-daily -- start
      sudo systemctl start cloudflared-ipv4

EOF
    exit 0
fi

log "0. 创建恢复包"
mkdir -p "$BACKUP_DIR"
crontab -l > "$BACKUP_DIR/crontab.txt" 2>/dev/null || true
pm2 jlist > "$BACKUP_DIR/pm2-list.json" 2>/dev/null || true
systemctl status cloudflared-ipv4 > "$BACKUP_DIR/cloudflared-status.txt" 2>/dev/null || true
ok "$BACKUP_DIR"

log "1. 清空 crontab"
N=$(crontab -l 2>/dev/null | grep -vcE '^#|^$')
crontab -r 2>/dev/null && ok "已清空（原有 $N 条，备份在 $BACKUP_DIR/crontab.txt）" || skip "本无 crontab"

EFFECTIVE=$(crontab -l 2>/dev/null | grep -vcE '^#|^$' || echo 0)
[ "${EFFECTIVE:-0}" -eq 0 ] && ok "确认无残留任务" || printf '  ⚠ 仍有 %s 条\n' "$EFFECTIVE"

log "2. 停止 PM2"
if pm2 describe ai-insight-daily > /dev/null 2>&1; then
    pm2 stop ai-insight-daily > /dev/null 2>&1
    pm2 delete ai-insight-daily > /dev/null 2>&1
    pm2 save > /dev/null 2>&1
    ok "已停止并删除（配置备份在 $BACKUP_DIR/pm2-list.json）"
else
    skip "PM2 里没有 ai-insight-daily"
fi

log "3. 停止 Cloudflare 隧道"
if systemctl is-active --quiet cloudflared-ipv4 2>/dev/null; then
    sudo systemctl stop cloudflared-ipv4
    sudo systemctl disable cloudflared-ipv4 2>/dev/null
    ok "已停止并禁用"
else
    skip "cloudflared-ipv4 未在运行"
fi

log "4. 确认端口已释放"
sleep 2
if ss -tlnp 2>/dev/null | grep -q ':3000'; then
    printf '  ⚠ 端口 3000 仍在监听：\n'
    ss -tlnp 2>/dev/null | grep ':3000' | sed 's/^/    /'
else
    ok "端口 3000 已释放"
fi

log "完成"
cat <<EOF

  本地已停用。网站现在只跑在阿里云上。

  ┌─ 恢复方法（万一要回退到本机）────────────────────┐
  │                                                  │
  │  crontab $BACKUP_DIR/crontab.txt
  │  cd ~/projects/ai-insight-daily
  │  pm2 start npm --name ai-insight-daily -- start
  │  sudo systemctl enable --now cloudflared-ipv4
  │                                                  │
  │  注意：恢复前先把域名/隧道指回本机。              │
  │                                                  │
  └──────────────────────────────────────────────────┘

  之后维护方式：

    改代码：  本地改 → git push → ./deploy.sh
    GitHub 不通：./deploy-rsync.sh
    看日志：  ssh 服务器 "pm2 logs ai-insight-daily --lines 50 --nostream"
    看成本：  每天 22:30 微信日报

EOF
