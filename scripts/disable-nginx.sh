#!/bin/bash
#
# 停用 nginx 并验证两条链路。
#
# 背景：
#   隧道 ingress 指向 http://127.0.0.1:3000，请求从未经过 nginx。
#   实测其访问日志中非 127.0.0.1 的请求为 0 条，一直在空转占 44MB。
#   2026-10-17 决定停用，文档已同步修正。
#
# 停用后：
#   域名访问   https://aibiliai.com        不受影响（走隧道 → 3000）
#   局域网     http://<本机IP>:3000        仍可用
#   局域网     http://<本机IP>（端口 80）   失效
#
# 用法：
#   sudo bash scripts/disable-nginx.sh

set -uo pipefail

LAN_IP=$(ip -4 addr show scope global 2>/dev/null | grep -oP 'inet \K192\.168\.[0-9]+\.[0-9]+' | head -1)
[ -z "$LAN_IP" ] && LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

echo "=== 0. 停用前的基线 ==="
echo "  局域网 IP: $LAN_IP"
for U in "http://127.0.0.1:3000/" "http://$LAN_IP:3000/" "http://$LAN_IP/" "https://aibiliai.com/"; do
  C=$(curl -s -o /dev/null --max-time 15 -w '%{http_code}' "$U" 2>/dev/null)
  printf '  %-30s HTTP %s\n' "$U" "$C"
done

echo ""
echo "=== 1. 记录 nginx 停用前的状态 ==="
systemctl is-enabled nginx 2>/dev/null | sed 's/^/  enabled: /'
systemctl is-active nginx 2>/dev/null | sed 's/^/  active:  /'
ps -C nginx -o rss= 2>/dev/null | awk '{s+=$1; n++} END {printf "  内存: %d 进程 / %.1f MB\n", n, s/1024}'

echo ""
echo "=== 2. 停用并禁止开机自启 ==="
systemctl stop nginx && echo "  ✓ 已停止"
systemctl disable nginx && echo "  ✓ 已禁止开机自启"

echo ""
echo "=== 3. 确认端口已释放 ==="
if ss -tln 2>/dev/null | grep -q ':80 '; then
  echo "  ⚠ :80 仍被监听："
  ss -tlnp 2>/dev/null | grep ':80 ' | sed 's/^/    /'
else
  echo "  ✓ :80 已无进程监听"
fi
echo "  :3000 监听情况:"
ss -tln 2>/dev/null | grep ':3000' | sed 's/^/    /'

echo ""
echo "=== 4. 验证停用后的链路 ==="
FAIL=0
echo "  ① 域名访问（最关键）"
for i in 1 2 3; do
  C=$(curl -s -o /dev/null --max-time 20 -w '%{http_code}' https://aibiliai.com/ 2>/dev/null)
  echo "     第 $i 次: $C"
  [ "$C" = "200" ] || FAIL=1
done

echo "  ② 局域网 :3000（应仍可用）"
C=$(curl -s -o /dev/null --max-time 15 -w '%{http_code}' "http://$LAN_IP:3000/" 2>/dev/null)
echo "     http://$LAN_IP:3000/  →  $C"
[ "$C" = "200" ] || FAIL=1

echo "  ③ 局域网 :80（应已失效）"
C=$(curl -s -o /dev/null --max-time 10 -w '%{http_code}' "http://$LAN_IP/" 2>/dev/null)
echo "     http://$LAN_IP/       →  $C  （000 或 502 表示已失效，符合预期）"

echo "  ④ 本机 :3000"
C=$(curl -s -o /dev/null --max-time 10 -w '%{http_code}' http://127.0.0.1:3000/ 2>/dev/null)
echo "     http://127.0.0.1:3000/  →  $C"
[ "$C" = "200" ] || FAIL=1

echo ""
echo "=== 5. 内存回收 ==="
free -h 2>/dev/null | head -2 | sed 's/^/  /'

echo ""
if [ "$FAIL" = "0" ]; then
  echo "✓ 完成。域名与局域网 :3000 均正常，nginx 已停用。"
  echo ""
  echo "  如需恢复："
  echo "    sudo systemctl enable --now nginx"
else
  echo "✗ 有链路异常，建议立即恢复 nginx："
  echo "    sudo systemctl enable --now nginx"
fi
