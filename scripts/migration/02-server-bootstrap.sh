#!/bin/bash
# ============================================================
#  新服务器初始化
#
#  在【阿里云服务器】上以 root 执行：
#      bash 02-server-bootstrap.sh
#
#  假设：Ubuntu 22.04 / 24.04，全新系统
#  幂等：可重复执行，已装的东西会跳过
# ============================================================

set -euo pipefail

APP_DIR="/root/ai-insight-daily"
NODE_MAJOR=22
TZ_NAME="Asia/Shanghai"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()  { printf '  ✓ %s\n' "$*"; }

log "1. 基础信息"
echo "  系统: $(. /etc/os-release && echo "$PRETTY_NAME")"
echo "  内核: $(uname -r)"
echo "  内存: $(free -h | awk '/^Mem:/{print $2}')"
echo "  磁盘: $(df -h / | awk 'NR==2{print $4" 可用"}')"
echo "  CPU:  $(nproc) 核"

log "2. 时区 → $TZ_NAME"
timedatectl set-timezone "$TZ_NAME" 2>/dev/null || ln -sf "/usr/share/zoneinfo/$TZ_NAME" /etc/localtime
ok "当前时间: $(date '+%Y-%m-%d %H:%M:%S %Z')"

log "3. 系统依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    curl ca-certificates gnupg git rsync sqlite3 unzip jq \
    build-essential python3 cron logrotate > /dev/null
ok "已安装 curl git rsync sqlite3 unzip jq gcc make python3 cron"

log "4. Node.js $NODE_MAJOR"
if command -v node > /dev/null 2>&1 && [ "$(node -v | cut -d. -f1 | tr -d v)" = "$NODE_MAJOR" ]; then
    ok "已安装: $(node -v)"
else
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null
    ok "已安装: $(node -v) / npm $(npm -v)"
fi

log "5. PM2"
if command -v pm2 > /dev/null 2>&1; then
    ok "已安装: $(pm2 -v)"
else
    npm install -g pm2 > /dev/null 2>&1
    ok "已安装: $(pm2 -v)"
fi
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
ok "已设置开机自启"

log "6. 交换分区（内存小于 4G 时创建 2G swap）"
MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$MEM_MB" -lt 4096 ] && [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile > /dev/null
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    ok "已创建 2G swap（内存 ${MEM_MB}MB，Next.js 构建需要余量）"
else
    ok "跳过（内存 ${MEM_MB}MB 或已有 swap）"
fi

log "7. 应用目录"
mkdir -p "$APP_DIR"
ok "$APP_DIR"

log "8. 日志轮转（PM2 日志别把磁盘写满）"
cat > /etc/logrotate.d/pm2-root <<'ROTATE'
/root/.pm2/logs/*.log {
    daily
    rotate 7
    missingok
    notifempty
    compress
    copytruncate
}
ROTATE
ok "/etc/logrotate.d/pm2-root（保留 7 天）"

log "9. 内核参数（tcp 快速回收，隧道场景有用）"
cat > /etc/sysctl.d/99-ai-insight.conf <<'SYSCTL'
net.core.somaxconn = 1024
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_tw_reuse = 1
vm.swappiness = 10
SYSCTL
sysctl -p /etc/sysctl.d/99-ai-insight.conf > /dev/null 2>&1
ok "已应用"

log "10. 防火墙检查"
if command -v ufw > /dev/null 2>&1; then
    ufw status | head -3
else
    echo "  ufw 未安装（阿里云用安全组控制，见下方说明）"
fi

cat <<'NOTE'

  ⚠️  阿里云还需要在【控制台 → 轻量应用服务器 → 防火墙】放行端口：
      · 22   （SSH，必须）
      · 3000 （应用端口，若走 Cloudflare 隧道则不需要对外）
      · 80/443（若域名直接 A 记录到本机，需要；用隧道则不需要）

  系统防火墙和阿里云安全组是两层，两层都要放行。

NOTE

log "完成"
echo ""
echo "  下一步："
echo "    1. 在本地执行 deploy-rsync.sh 把代码传上去（首次）"
echo "    2. 上传 .env.local"
echo "    3. 上传数据库"
echo "    4. 执行 build + pm2 start"
echo "    5. 导入 crontab"
echo ""
echo "  汇总:"
echo "    Node $(node -v) / npm $(npm -v) / PM2 $(pm2 -v)"
echo "    应用目录 $APP_DIR"
echo "    swap $(free -h | awk '/^Swap:/{print $2}')"
