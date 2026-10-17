#!/bin/bash
#
# 管理 Cloudflare 隧道的两个服务版本。
#
#   cloudflared.service        原有服务（IPv4/IPv6 自动选择）—— 保留不动
#   cloudflared-ipv4.service   新增服务（强制 IPv4）—— 建议启用
#
# 为什么保留两个：出问题时一条命令就能切回原版，不必回忆改了什么。
#
# 用法：
#   sudo bash manage-cloudflared.sh status     查看两者状态与当前连接
#   sudo bash manage-cloudflared.sh install    安装新服务并切换过去
#   sudo bash manage-cloudflared.sh rollback   切回原服务
#
# 注意：两个服务不能同时运行 —— 同一个 token 会建立重复连接。

set -uo pipefail

NEW_UNIT="/etc/systemd/system/cloudflared-ipv4.service"
OLD_UNIT="cloudflared.service"
NEW="cloudflared-ipv4.service"

# 单元文件内容。与原服务的差异只有 --edge-ip-version 4 与 Restart 策略。
read -r -d '' UNIT_CONTENT <<'UNITEOF'
[Unit]
Description=Cloudflare Tunnel client (IPv4 forced)
Documentation=https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
TimeoutStartSec=30
Type=notify
ExecStart=/usr/bin/cloudflared --no-autoupdate --edge-ip-version 4 --edge-bind-address 0.0.0.0 --protocol http2 tunnel run --token-file /etc/cloudflared/token
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
UNITEOF

require_root() {
  if [ "$(id -u)" != "0" ]; then
    echo "✗ 需要 root 权限，请用 sudo 运行"
    exit 1
  fi
}

show_status() {
  echo "=== 服务状态 ==="
  for S in "$OLD_UNIT" "$NEW"; do
    # 用 systemctl cat 判断而不是 list-unit-files | grep -q：
    # script 开了 pipefail，grep -q 提前退出会让管道返回 141，
    # 导致已安装的服务被误判为「未安装」。
    if systemctl cat "$S" > /dev/null 2>&1; then
      # 注意：systemctl is-enabled 对 disabled 的服务会输出 "disabled"
      # 但退出码为 1，因此不能用 `|| echo "-"`（那会追加一行 "-"）。
      E=$(systemctl is-enabled "$S" 2>/dev/null); E=${E:-"-"}
      A=$(systemctl is-active "$S" 2>/dev/null); A=${A:-"-"}
      printf '  %-28s enabled=%-10s active=%s\n' "$S" "$E" "$A"
    else
      printf '  %-28s (未安装)\n' "$S"
    fi
  done

  echo ""
  echo "=== 当前隧道连接（看 ip= 是 IPv4 还是 IPv6）==="
  for S in "$OLD_UNIT" "$NEW"; do
    systemctl cat "$S" > /dev/null 2>&1 || continue
    [ "$(systemctl is-active "$S" 2>/dev/null)" = "active" ] || continue

    echo "  [$S]"
    journalctl -u "$S" -n 200 --no-pager 2>/dev/null \
      | grep -oE 'ip=[0-9a-fA-F:.]+.?(location=[a-z0-9]+)?' \
      | tail -6 | sed 's/^/    /'

    echo "    最近 10 分钟内的异常计数:"
    journalctl -u "$S" --since '10 min ago' --no-pager 2>/dev/null \
      | grep -c 'network is unreachable' \
      | sed 's/^/      network is unreachable（多为 ICMP proxy 的 IPv6 尝试，非隧道连接）: /'
    journalctl -u "$S" --since '10 min ago' --no-pager 2>/dev/null \
      | grep -c 'Connection terminated' \
      | sed 's/^/      Connection terminated:   /'
  done

  echo ""
  echo "=== 站点可用性 ==="
  for i in 1 2 3; do
    R=$(curl -4 -s -o /dev/null --max-time 15 -w '%{http_code} %{time_total}s' https://aibiliai.com/ 2>/dev/null)
    echo "  第 $i 次: $R"
  done
}

do_install() {
  require_root

  echo "=== 1. 写入新单元文件 ==="
  printf '%s\n' "$UNIT_CONTENT" > "$NEW_UNIT"
  echo "  已写入 $NEW_UNIT"
  echo "  校验："
  grep -E 'ExecStart|Restart=' "$NEW_UNIT" | sed 's/^/    /'

  echo ""
  echo "=== 2. 重载 systemd ==="
  systemctl daemon-reload
  echo "  完成"

  echo ""
  echo "=== 3. 停用旧服务、启用新服务（不能同时运行）==="
  systemctl stop "$OLD_UNIT" 2>/dev/null && echo "  已停止 $OLD_UNIT"
  systemctl disable "$OLD_UNIT" 2>/dev/null && echo "  已禁用 $OLD_UNIT（下次开机不再启动）"

  systemctl enable "$NEW" 2>/dev/null && echo "  已启用 $NEW"
  systemctl start "$NEW" 2>/dev/null && echo "  已启动 $NEW"

  echo ""
  echo "=== 4. 等待连接建立（15 秒）==="
  sleep 15

  echo ""
  echo "=== 5. 验证 ==="
  systemctl is-active "$NEW" | sed 's/^/  状态: /'
  echo ""
  echo "  隧道连接:"
  journalctl -u "$NEW" -n 60 --no-pager 2>/dev/null \
    | grep -oE 'ip=[0-9a-fA-F:.]+.*location=[a-z0-9]+|location=[a-z0-9]+.*ip=[0-9a-fA-F:.]+' \
    | tail -5 | sed 's/^/    /'

  echo ""
  echo "  期望看到 ip=104.x 或 ip=172.x（IPv4）。若仍是 2606:4700: 则 IPv4 强制未生效。"

  echo ""
  echo "=== 6. 站点可用性 ==="
  for i in 1 2 3; do
    R=$(curl -4 -s -o /dev/null --max-time 20 -w '%{http_code} %{time_total}s' https://aibiliai.com/ 2>/dev/null)
    echo "  第 $i 次: $R"
  done

  echo ""
  echo "如需切回原服务：sudo bash $0 rollback"
}

do_rollback() {
  require_root

  echo "=== 切回原服务 $OLD_UNIT ==="
  systemctl stop "$NEW" 2>/dev/null && echo "  已停止 $NEW"
  systemctl disable "$NEW" 2>/dev/null && echo "  已禁用 $NEW"

  systemctl enable "$OLD_UNIT" 2>/dev/null && echo "  已启用 $OLD_UNIT"
  systemctl start "$OLD_UNIT" 2>/dev/null && echo "  已启动 $OLD_UNIT"

  echo ""
  sleep 10
  systemctl is-active "$OLD_UNIT" | sed 's/^/  状态: /'
  echo ""
  for i in 1 2 3; do
    R=$(curl -4 -s -o /dev/null --max-time 20 -w '%{http_code} %{time_total}s' https://aibiliai.com/ 2>/dev/null)
    echo "  站点第 $i 次: $R"
  done

  echo ""
  echo "新服务的单元文件仍在 $NEW_UNIT（未删除），
重新启用即可：sudo bash $0 install"
}

case "${1:-status}" in
  status)   show_status ;;
  install)  do_install ;;
  rollback) do_rollback ;;
  *)
    echo "用法: sudo bash $0 {status|install|rollback}"
    exit 1
    ;;
esac
